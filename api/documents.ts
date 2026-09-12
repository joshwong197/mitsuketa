import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../mcp/lib/rateLimit.js';

const COMPANIES_OFFICE_BASE = 'https://app.companiesoffice.govt.nz';

// A directors panel fetches at most a dozen or two consent PDFs at once;
// 300/min per IP never touches real use but stops bulk document scraping
// riding through this deployment.
const DOCUMENTS_LIMIT_PER_MINUTE = 300;

function documentDownloadUrl(docId: string) {
    return `${COMPANIES_OFFICE_BASE}/companies/app/service/services/documents/${docId}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || 'anonymous';
    const rl = checkRateLimit(clientIp, 'documents', DOCUMENTS_LIMIT_PER_MINUTE);
    if (!rl.allowed) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Request limit of ${rl.limit} per minute exceeded. Please wait a moment and try again.`,
        });
    }

    const { docId } = req.query;

    if (!docId || typeof docId !== 'string') {
        return res.status(400).json({ error: 'Missing docId parameter' });
    }

    // Validate the doc ID is a hex string (prevent path traversal)
    if (!/^[A-Fa-f0-9]+$/.test(docId)) {
        return res.status(400).json({ error: 'Invalid document ID' });
    }

    try {
        const url = documentDownloadUrl(docId);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Document fetch failed: ${response.status}`,
            });
        }

        const contentType = response.headers.get('content-type') || 'application/pdf';
        const buffer = Buffer.from(await response.arrayBuffer());

        res.setHeader('Content-Type', contentType);
        // Consent forms carry signatures and residential addresses — public
        // register data, but they don't belong in shared/CDN caches. The
        // browser that asked may keep its copy for the day.
        res.setHeader('Cache-Control', 'private, max-age=86400');
        return res.send(buffer);
    } catch (err: any) {
        console.error('Document proxy error:', err);
        return res.status(500).json({ error: 'Failed to fetch document' });
    }
}
