import { useState, useCallback } from 'react';

export interface ConsentFormLink {
    type: 'direct' | 'matched';
    documentId: string;
    url: string;
    filingDate?: string;
    matchConfidence: 'high' | 'medium' | 'low';
}

interface BatchConsentState {
    loading: boolean;
    error: string | null;
    results: Record<string, ConsentFormLink | null>;
}

export function useConsentForms() {
    const [consentState, setConsentState] = useState<BatchConsentState>({
        loading: false,
        error: null,
        results: {},
    });

    const fetchForDirector = useCallback(
        async (
            firstName: string,
            lastName: string,
            companies: Array<{ companyNumber: string; status: string }>
        ): Promise<Record<string, ConsentFormLink | null>> => {
            setConsentState({ loading: true, error: null, results: {} });

            try {
                const res = await fetch('/api/consent-forms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ firstName, lastName, companies }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to fetch consent forms');
                }

                const data = await res.json();
                setConsentState({ loading: false, error: null, results: data.results });
                return data.results;
            } catch (err) {
                const error = err instanceof Error ? err.message : 'Failed';
                setConsentState({ loading: false, error, results: {} });
                return {};
            }
        },
        []
    );

    const resetConsent = useCallback(() => {
        setConsentState({ loading: false, error: null, results: {} });
    }, []);

    return { consentState, fetchForDirector, resetConsent };
}
