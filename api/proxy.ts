import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveApiKey } from '../mcp/lib/keys.js';

// Simple in-memory rate limiting (Soft limit)
const rateLimit = new Map<string, { count: number; reset: number }>();
const MAX_REQUESTS_PER_MINUTE = 200;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 0. Rate limiting check
    const clientIp = (req.headers['x-forwarded-for'] as string) || 'anonymous';
    const now = Date.now();
    const windowMs = 60 * 1000;

    let userLimit = rateLimit.get(clientIp);

    if (!userLimit || now > userLimit.reset) {
        userLimit = { count: 0, reset: now + windowMs };
    }

    userLimit.count++;
    rateLimit.set(clientIp, userLimit);

    if (userLimit.count > MAX_REQUESTS_PER_MINUTE) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'You have exceeded the request limit of 200 per minute. This is a security measure to protect the API keys. Please wait a moment and try again.'
        });
    }

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
    const finalKey = resolveApiKey(apiType, userKey);

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
