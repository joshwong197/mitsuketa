import type { VercelRequest, VercelResponse } from '@vercel/node';

const COMPANIES_OFFICE_BASE = 'https://app.companiesoffice.govt.nz';

function documentDownloadUrl(docId: string) {
    return `${COMPANIES_OFFICE_BASE}/companies/app/service/services/documents/${docId}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
    } catch (err: any) {
        console.error('Document proxy error:', err);
        return res.status(500).json({ error: 'Failed to fetch document' });
    }
}
