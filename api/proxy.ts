import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveApiKey } from '../mcp/lib/keys.js';
import { checkRateLimit } from '../mcp/lib/rateLimit.js';

// Generous by design: a whole team can sit behind one office IP, and one
// full graph build fans out to hundreds of proxy calls (the crawler's own
// smartDelay tops out around 600/min). 1200 leaves room for two builds at
// full tilt plus UI chatter, while a scripted harvester doing thousands a
// minute still hits the wall. The registers behind this are free — the
// limit is anti-abuse, not cost control.
const PROXY_LIMIT_PER_MINUTE = 1200;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 0. Rate limiting check
    const clientIp = (req.headers['x-forwarded-for'] as string) || 'anonymous';
    const rl = checkRateLimit(clientIp, 'proxy', PROXY_LIMIT_PER_MINUTE);
    if (!rl.allowed) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `You have exceeded the request limit of ${rl.limit} per minute. This is an anti-abuse measure. Please wait a moment and try again.`
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
