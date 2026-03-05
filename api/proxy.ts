import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Get the target URL from the query parameter 
    // e.g. /api/proxy?path=/nzbn/v5/entities
    const { path } = req.query;
    const userKey = req.headers['x-user-api-key'] as string;
    const apiType = req.headers['x-api-type'] as string;

    if (!path || typeof path !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid path parameter' });
    }

    // 2. Determine which key to use
    // Priority: User Provided Key > Your Secret Org Key
    let finalKey = userKey;

    if (!finalKey || finalKey.trim() === '') {
        const secrets: Record<string, string | undefined> = {
            'nzbn': process.env.ORG_NZBN_KEY,
            'companies': process.env.ORG_COMPANIES_KEY,
            'disqualified': process.env.ORG_DISQUALIFIED_KEY,
            'insolvency': process.env.ORG_INSOLVENCY_KEY
        };
        finalKey = secrets[apiType] || '';
    }

    // 3. Construct target Government API URL
    // We enforce the production gateway URL here
    const targetUrl = `https://api.business.govt.nz/gateway${path}`;

    try {
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'Ocp-Apim-Subscription-Key': finalKey,
                'Accept': 'application/json',
            }
        });

        // Check if the response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            return res.status(response.status).json(data);
        } else {
            const text = await response.text();
            return res.status(response.status).send(text);
        }
    } catch (error: any) {
        console.error('Proxy Error:', error);
        return res.status(500).json({ error: 'Failed to fetch from upstream API', details: error.message });
    }
}
