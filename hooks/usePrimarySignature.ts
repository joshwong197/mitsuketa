import { useEffect, useMemo, useState } from 'react';
import { PersonCompanyResult } from '../types';
import { renderSignatureCrop } from '../utils/signatureCrop';

export interface PrimarySignature {
    /** 'none' means we looked and there was nothing to show — distinct from 'idle'. */
    status: 'idle' | 'loading' | 'ready' | 'none';
    imageDataUrl: string | null;
    companyName: string | null;
    filingDate: string | null;
    /** Consent forms found beyond the one rendered — the KYD panel shows them all. */
    otherCount: number;
}

const IDLE: PrimarySignature = { status: 'idle', imageDataUrl: null, companyName: null, filingDate: null, otherCount: 0 };

/**
 * Fetches ONE signature — the most recently filed consent form — for the identity
 * spine, lazily after the page has painted.
 *
 * Cost is deliberately bounded: the KYD panel renders a PDF for every active
 * company, which on a large subject means many downloads plus the pdfjs bundle.
 * Up front we want the reader to see *a* signature without paying for all of
 * them, so this resolves the consent-form list (one request) and renders only the
 * newest. Everything else stays behind the panel.
 *
 * The effect depends on stable primitives, NOT on the `results` array identity.
 * That matters: App.tsx replaces the results array when background status
 * enrichment lands, and keying the effect on the array meant the in-flight
 * request was cancelled mid-flight while a "already started" guard blocked the
 * retry — leaving the spine stuck on its loading state forever.
 */
export function usePrimarySignature(results: PersonCompanyResult[]): PrimarySignature {
    const [state, setState] = useState<PrimarySignature>(IDLE);

    const firstName = results.find(r => r.firstName)?.firstName?.trim() || '';
    const lastName = results.find(r => r.lastName)?.lastName?.trim() || '';

    // Consent forms are only filed for live directorships, and the lookup is keyed
    // on company number — the same eligibility rule the KYD panel applies.
    const active = useMemo(
        () => results.filter(r => r.companyNumber && (r.entityStatusCode || 0) < 80 && !r.isInactive),
        [results]
    );
    // Stable identity for the request: same person, same companies → same key, so
    // enrichment re-rendering with a fresh array does not restart anything.
    const activeKey = active.map(c => c.companyNumber).sort().join(',');

    useEffect(() => {
        if (!firstName || !lastName || !activeKey) {
            setState(IDLE);
            return;
        }

        let cancelled = false;
        setState({ ...IDLE, status: 'loading' });

        (async () => {
            try {
                const res = await fetch('/api/consent-forms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        firstName,
                        lastName,
                        companies: activeKey.split(',').map(companyNumber => ({ companyNumber, status: 'active' })),
                    }),
                });
                if (!res.ok) throw new Error(`consent-forms ${res.status}`);
                const data = await res.json();

                const found = Object.entries(data.results || {})
                    .filter(([, link]) => !!(link as any)?.url)
                    .map(([companyNumber, link]) => ({
                        url: (link as any).url as string,
                        filingDate: ((link as any).filingDate as string) || '',
                        companyName: results.find(r => r.companyNumber === companyNumber)?.companyName || '',
                    }))
                    // Newest filing first — an old signature is the least useful to lead with.
                    .sort((a, b) => (b.filingDate || '').localeCompare(a.filingDate || ''));

                if (cancelled) return;
                if (found.length === 0) { setState({ ...IDLE, status: 'none' }); return; }

                const primary = found[0];
                const imageDataUrl = await renderSignatureCrop(primary.url);
                if (cancelled) return;

                setState(imageDataUrl
                    ? {
                        status: 'ready',
                        imageDataUrl,
                        companyName: primary.companyName,
                        filingDate: primary.filingDate || null,
                        otherCount: found.length - 1,
                    }
                    // The form exists but page 1 wouldn't render — say nothing was shown
                    // rather than leaving an empty frame.
                    : { ...IDLE, status: 'none', otherCount: found.length - 1 });
            } catch (err) {
                console.warn('[KYD] primary signature lookup failed:', err);
                if (!cancelled) setState({ ...IDLE, status: 'none' });
            }
        })();

        return () => { cancelled = true; };
        // results is intentionally omitted — see the note above; activeKey covers it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firstName, lastName, activeKey]);

    return state;
}
