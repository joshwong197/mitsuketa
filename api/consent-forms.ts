import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as cheerio from 'cheerio';

const COMPANIES_OFFICE_BASE = 'https://app.companiesoffice.govt.nz';

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

async function scrapeDirectorsPage(companyNumber: string): Promise<ScrapedDirector[]> {
    const url = directorsPageUrl(companyNumber);
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
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
    directorLastName: string
): Promise<ConsentFormLink | null> {
    const directors = await scrapeDirectorsPage(companyNumber);

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

    let body: { firstName: string; lastName: string; companies: Array<{ companyNumber: string; status: string }> };
    try {
        body = req.body;
    } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { firstName, lastName, companies } = body;

    if (!lastName) {
        return res.status(400).json({ error: 'lastName is required' });
    }

    // Only process active directorships
    const activeCompanies = companies.filter((c) => c.status === 'active');

    if (activeCompanies.length === 0) {
        return res.json({ results: {} });
    }

    // Scrape all directors pages in parallel with per-company timeout
    const entries = await Promise.allSettled(
        activeCompanies.map(async (company) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            try {
                const link = await findConsentFormForDirector(
                    company.companyNumber,
                    firstName,
                    lastName
                );
                return { companyNumber: company.companyNumber, link };
            } finally {
                clearTimeout(timeout);
            }
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
