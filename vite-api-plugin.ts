// Dev-only Vite plugin that emulates the Vercel serverless functions under api/
// so that `npm run dev` can serve /api/proxy, /api/consent-forms and /api/documents
// the same way `vercel dev` / production does.
//
// Production is unaffected: Vercel deploys api/*.ts directly as serverless
// functions and never loads this file.
import type { Plugin, ViteDevServer } from 'vite';
import { loadEnv } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

// Server-side env vars the handlers read: the four org API keys used by
// mcp/lib/keys.ts, plus LINZ, Neon and audit-admin configuration.
// Loaded from .env (or the process environment) and copied onto process.env so
// the handlers -- which read process.env directly -- see them exactly as they
// would on Vercel. Missing required configuration fails closed in dev too.
const SERVER_ENV_KEYS = [
    'ORG_NZBN_KEY',
    'ORG_COMPANIES_KEY',
    'ORG_DISQUALIFIED_KEY',
    'ORG_INSOLVENCY_KEY',
    'LINZ_API_KEY',
    'LINZ_BASEMAPS_KEY',
    'DATABASE_URL',
    'PROPERTY_AUDIT_ADMINS',
] as const;

// Per-user property credentials are one variable each and their names are not
// known up front (PROPERTY_PW_<slugged email>), so they are matched by prefix
// rather than listed. Local and Vercel handlers use the same per-user gate.
const SERVER_ENV_PREFIXES = ['PROPERTY_PW_'] as const;

const API_ROUTES: Record<string, string> = {
    '/api/proxy': '/api/proxy.ts',
    '/api/consent-forms': '/api/consent-forms.ts',
    '/api/documents': '/api/documents.ts',
    '/api/property': '/api/property.ts',
};

// Vercel parses cookies onto req.cookies; Node's http server does not.
function parseCookies(header: string | undefined): Record<string, string> {
    const out: Record<string, string> = {};
    for (const pair of (header || '').split(';')) {
        const eq = pair.indexOf('=');
        if (eq < 1) continue;
        const name = pair.slice(0, eq).trim();
        if (name) out[name] = decodeURIComponent(pair.slice(eq + 1).trim());
    }
    return out;
}

// Minimal VercelResponse-compatible shim over Node's ServerResponse. Only
// implements what api/proxy.ts, api/consent-forms.ts and api/documents.ts
// actually call: status().json()/.send(), res.json(), res.send(), setHeader.
function createVercelResponseShim(res: ServerResponse): any {
    const shim: any = res;
    shim.status = (code: number) => {
        res.statusCode = code;
        return shim;
    };
    shim.json = (body: unknown) => {
        if (!res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.end(JSON.stringify(body));
        return shim;
    };
    shim.send = (body: string | Buffer) => {
        if (!res.getHeader('Content-Type')) {
            res.setHeader(
                'Content-Type',
                Buffer.isBuffer(body) ? 'application/octet-stream' : 'text/plain; charset=utf-8'
            );
        }
        res.end(body);
        return shim;
    };
    return shim;
}

async function readJsonBody(req: IncomingMessage): Promise<any> {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) return undefined;

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf-8');
    if (!raw) return undefined;
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
}

export default function apiPlugin(): Plugin {
    return {
        name: 'mitsuketa-dev-api',
        apply: 'serve',
        config(_config, { mode }) {
            const env = loadEnv(mode, '.', '');
            const wanted = (key: string) =>
                (SERVER_ENV_KEYS as readonly string[]).includes(key)
                || SERVER_ENV_PREFIXES.some(p => key.startsWith(p));
            for (const key of Object.keys(env)) {
                if (wanted(key) && env[key] && !process.env[key]) {
                    process.env[key] = env[key];
                }
            }
        },
        configureServer(server: ViteDevServer) {
            const moduleCache = new Map<string, any>();

            async function loadHandler(modulePath: string) {
                if (!moduleCache.has(modulePath)) {
                    const mod = await server.ssrLoadModule(modulePath);
                    moduleCache.set(modulePath, mod.default);
                }
                return moduleCache.get(modulePath);
            }

            server.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url || '', 'http://localhost');
                const pathname = url.pathname;
                const modulePath = API_ROUTES[pathname];
                if (!modulePath) return next();

                try {
                    // Vercel-style req.query: string | string[] per key.
                    const query: Record<string, string | string[]> = {};
                    for (const key of url.searchParams.keys()) {
                        const all = url.searchParams.getAll(key);
                        query[key] = all.length > 1 ? all : all[0];
                    }
                    (req as any).query = query;
                    (req as any).cookies = parseCookies(req.headers.cookie);
                    // Match Vercel's trusted proxy metadata for loopback dev.
                    req.headers['x-forwarded-proto'] = 'http';
                    req.headers['x-forwarded-for'] = req.socket.remoteAddress;

                    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                        (req as any).body = await readJsonBody(req);
                    }

                    const vercelRes = createVercelResponseShim(res);
                    const handler = await loadHandler(modulePath);
                    await handler(req, vercelRes);
                } catch (err) {
                    console.error(`[mitsuketa-dev-api] Error handling ${pathname}:`, err);
                    if (!res.headersSent) {
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json; charset=utf-8');
                        res.end(JSON.stringify({ error: 'Dev API middleware error', details: String(err) }));
                    }
                }
            });
        },
    };
}
