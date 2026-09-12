import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as cheerio from 'cheerio';
import { checkRateLimit } from '../mcp/lib/rateLimit.js';

const COMPANIES_OFFICE_BASE = 'https://app.companiesoffice.govt.nz';

// Each request fans out to one Companies Office page scrape per active
// directorship, so the guards sit on both axes and both are deliberately
// roomy: 150 companies covers even a professional director several times
// over, and 60 requests a minute is a person clicking through people far
// faster than anyone works — while a script trying to relay thousands of
// scrapes through this deployment gets stopped.
const CONSENT_LIMIT_PER_MINUTE = 60;
const MAX_COMPANIES_PER_REQUEST = 150;
const SCRAPE_TIMEOUT_MS = 8000;

function directorsPageUrl(companyNumber: string) {
    return `${COMPANIES_OFFICE_BASE}/companies/app/ui/pages/companies/${companyNumber}/directors`;
}

interface ConsentFormLink {
    type: 'direct' | 'matched';
    documentId: string;
    url: string;
    filingDate?: string;
    matchConfidence: 'high' | 'medium' | 'low';
}

interface ScrapedDirector {
    name: string;
    address: string;
    appointmentDate: string;
    consentLink: ConsentFormLink | null;
    isCurrent: boolean;
}

function parseDirectorsPage(html: string): ScrapedDirector[] {
    const $ = cheerio.load(html);
    const directors: ScrapedDirector[] = [];

    // Collect all consent-related links in order
    const consentLinks: {
        docId: string | null;
        type: 'direct' | 'documents-page';
        url: string;
    }[] = [];

    $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().toLowerCase();

        if (!text.includes('consent')) return;

        if (href.includes('/service/services/documents/')) {
            const match = href.match(/documents\/([A-F0-9]+)/i);
            consentLinks.push({
                docId: match ? match[1] : null,
                type: 'direct',
                url: href,
            });
        } else if (href.includes('javascript:') && href.includes('documents')) {
            consentLinks.push({
                docId: null,
                type: 'documents-page',
                url: href,
            });
        }
    });

    // Parse director text blocks
    const bodyText = $('body').text();
    const blocks = bodyText.split(/Full\s+legal\s+name:\s*/i);

    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const lines = block
            .split(/\n/)
            .map((l) => l.trim())
            .filter(Boolean);

        // Name is spread across first two lines
        let nameParts: string[] = [];
        for (const line of lines) {
            if (
                /^(Residential\s+Address|Appointment\s+Date|Shareholder|Ceased\s+date|View\s+Consent|Link\s+to)/i.test(
                    line
                )
            ) {
                break;
            }
            nameParts.push(line);
            if (nameParts.length >= 2) break;
        }

        const name = nameParts.join(' ').replace(/\s+/g, ' ').trim();
        if (!name) continue;

        const addrMatch = block.match(
            /Residential\s+Address:\s*([\s\S]*?)(?=Appointment\s+Date:|$)/i
        );
        const address = addrMatch
            ? addrMatch[1].replace(/\s+/g, ' ').trim().replace(/,\s*$/, '')
            : '';

        const dateMatch = block.match(/Appointment\s+Date:\s*([^\n]+)/i);
        const appointmentDate = dateMatch ? dateMatch[1].trim() : '';

        const linkIndex = i - 1;
        let consentLink: ConsentFormLink | null = null;

        if (linkIndex < consentLinks.length) {
            const link = consentLinks[linkIndex];
            if (link.type === 'direct' && link.docId) {
                consentLink = {
                    type: 'direct',
                    documentId: link.docId,
                    url: `/api/documents?docId=${link.docId}`,
                    matchConfidence: 'high',
                };
            }
        }

        directors.push({
            name,
            address,
            appointmentDate,
            consentLink,
            isCurrent: consentLink?.type === 'direct',
        });
    }

    return directors;
}

async function scrapeDirectorsPage(companyNumber: string, signal?: AbortSignal): Promise<ScrapedDirector[]> {
    const url = directorsPageUrl(companyNumber);
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal,
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch directors page: ${res.status}`);
    }

    const html = await res.text();
    return parseDirectorsPage(html);
}

async function findConsentFormForDirector(
    companyNumber: string,
    directorFirstName: string,
    directorLastName: string,
    signal?: AbortSignal
): Promise<ConsentFormLink | null> {
    const directors = await scrapeDirectorsPage(companyNumber, signal);

    if (directors.length === 0) return null;

    const lastNameUpper = directorLastName.toUpperCase();
    const firstNameUpper = directorFirstName.toUpperCase();

    // Try exact first+last match — only return direct links (high confidence)
    for (const dir of directors) {
        const dirUpper = dir.name.toUpperCase();
        if (dirUpper.includes(firstNameUpper) && dirUpper.includes(lastNameUpper)) {
            if (dir.consentLink?.type === 'direct') return dir.consentLink;
        }
    }

    // Try last name only match — only return direct links (high confidence)
    for (const dir of directors) {
        if (dir.name.toUpperCase().includes(lastNameUpper)) {
            if (dir.consentLink?.type === 'direct') return dir.consentLink;
        }
    }

    return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const clientIp = (req.headers['x-forwarded-for'] as string) || 'anonymous';
    const rl = checkRateLimit(clientIp, 'consent-forms', CONSENT_LIMIT_PER_MINUTE);
    if (!rl.allowed) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Request limit of ${rl.limit} per minute exceeded. Please wait a moment and try again.`,
        });
    }

    const body = (req.body ?? {}) as { firstName?: unknown; lastName?: unknown; companies?: unknown };

    const firstName = typeof body.firstName === 'string' ? body.firstName : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName : '';
    if (!lastName) {
        return res.status(400).json({ error: 'lastName is required' });
    }
    if (!Array.isArray(body.companies)) {
        return res.status(400).json({ error: 'companies must be an array' });
    }

    // Only process active directorships, and only well-formed entries — every
    // companyNumber is interpolated into a Companies Office URL downstream.
    let activeCompanies = body.companies.filter(
        (c: any): c is { companyNumber: string; status: string } =>
            !!c && c.status === 'active' && typeof c.companyNumber === 'string' && /^[A-Za-z0-9]{1,16}$/.test(c.companyNumber)
    );

    if (activeCompanies.length > MAX_COMPANIES_PER_REQUEST) {
        console.warn(`[consent-forms] truncating ${activeCompanies.length} companies to ${MAX_COMPANIES_PER_REQUEST}`);
        activeCompanies = activeCompanies.slice(0, MAX_COMPANIES_PER_REQUEST);
    }

    if (activeCompanies.length === 0) {
        return res.json({ results: {} });
    }

    // Scrape all directors pages in parallel with per-company timeout
    const entries = await Promise.allSettled(
        activeCompanies.map(async (company) => {
            const link = await findConsentFormForDirector(
                company.companyNumber,
                firstName,
                lastName,
                AbortSignal.timeout(SCRAPE_TIMEOUT_MS)
            );
            return { companyNumber: company.companyNumber, link };
        })
    );

    const results: Record<string, ConsentFormLink | null> = {};
    for (const entry of entries) {
        if (entry.status === 'fulfilled') {
            const { companyNumber, link } = entry.value;
            results[companyNumber] = link?.type === 'direct' ? link : null;
        }
    }

    return res.json({ results });
}
