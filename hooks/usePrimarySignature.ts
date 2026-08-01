import { useEffect, useRef, useState } from 'react';
import { PersonCompanyResult } from '../types';
import { renderSignatureCrop } from '../utils/signatureCrop';

interface PrimarySignature {
    loading: boolean;
    imageDataUrl: string | null;
    companyName: string | null;
    filingDate: string | null;
    /** Consent forms found beyond the one rendered — the KYD panel shows them all. */
    otherCount: number;
}

const IDLE: PrimarySignature = { loading: false, imageDataUrl: null, companyName: null, filingDate: null, otherCount: 0 };

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
 * Non-fatal throughout: any failure just leaves the spine without a signature.
 */
export function usePrimarySignature(results: PersonCompanyResult[]): PrimarySignature {
    const [state, setState] = useState<PrimarySignature>(IDLE);
    const startedRef = useRef(false);

    useEffect(() => {
        if (startedRef.current) return;

        const firstName = results.find(r => r.firstName)?.firstName || '';
        const lastName = results.find(r => r.lastName)?.lastName || '';
        // Consent forms are only filed for live directorships, and the lookup is
        // keyed on company number — same eligibility rule the KYD panel uses.
        const active = results.filter(r => r.companyNumber && (r.entityStatusCode || 0) < 80 && !r.isInactive);
        if (!firstName || !lastName || active.length === 0) return;

        startedRef.current = true;
        let cancelled = false;
        setState({ ...IDLE, loading: true });

        (async () => {
            try {
                const res = await fetch('/api/consent-forms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        firstName,
                        lastName,
                        companies: active.map(c => ({ companyNumber: c.companyNumber!, status: 'active' })),
                    }),
                });
                if (!res.ok) throw new Error(String(res.status));
                const data = await res.json();

                const found = Object.entries(data.results || {})
                    .filter(([, link]) => !!link)
                    .map(([companyNumber, link]) => ({
                        companyNumber,
                        url: (link as any).url as string,
                        filingDate: ((link as any).filingDate as string) || '',
                        companyName: results.find(r => r.companyNumber === companyNumber)?.companyName || '',
                    }))
                    // Newest filing first — an old signature is the least useful one to lead with.
                    .sort((a, b) => (b.filingDate || '').localeCompare(a.filingDate || ''));

                if (found.length === 0) { if (!cancelled) setState(IDLE); return; }

                const primary = found[0];
                const imageDataUrl = await renderSignatureCrop(primary.url);
                if (cancelled) return;

                setState({
                    loading: false,
                    imageDataUrl,
                    companyName: primary.companyName,
                    filingDate: primary.filingDate || null,
                    otherCount: found.length - 1,
                });
            } catch {
                if (!cancelled) setState(IDLE);
            }
        })();

        return () => { cancelled = true; };
    }, [results]);

    return state;
}
