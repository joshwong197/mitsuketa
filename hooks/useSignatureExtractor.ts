import { useState, useCallback, useRef } from 'react';

const MAX_CONCURRENT = 3;
const RENDER_SCALE = 2.0;
// Signature region: focused on the consent/signature area of the form
// Layout: header+company (0-25%), director details+address (25-44%),
//         consent+signature+date (44-64%), disqualification text (64-100%)
const SIGNATURE_START_RATIO = 0.44;
const SIGNATURE_END_RATIO = 0.66;

export interface SignatureExtractionResult {
    companyNumber: string;
    companyName: string;
    pdfUrl: string | null;
    imageDataUrl: string | null;
    loading: boolean;
    error: string | null;
}

interface ExtractionJob {
    companyNumber: string;
    companyName: string;
    pdfUrl: string;
}

export function useSignatureExtractor() {
    const [results, setResults] = useState<Map<string, SignatureExtractionResult>>(new Map());
    const pdfjsRef = useRef<any>(null);
    const queueRef = useRef<ExtractionJob[]>([]);
    const activeCountRef = useRef(0);
    const abortedRef = useRef(false);

    const ensurePdfjs = async () => {
        if (!pdfjsRef.current) {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
            pdfjsRef.current = pdfjsLib;
        }
        return pdfjsRef.current;
    };

    const processNext = useCallback(async () => {
        if (
            abortedRef.current ||
            activeCountRef.current >= MAX_CONCURRENT ||
            queueRef.current.length === 0
        ) {
            return;
        }

        activeCountRef.current++;
        const job = queueRef.current.shift()!;

        try {
            const pdfjsLib = await ensurePdfjs();

            if (abortedRef.current) return;

            const pdf = await pdfjsLib.getDocument(job.pdfUrl).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: RENDER_SCALE });

            // Render full page onto hidden canvas
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d')!;

            await page.render({ canvasContext: ctx, viewport }).promise;

            if (abortedRef.current) return;

            // Extract signature region (middle band: ~44-66% of page)
            const sigCanvas = document.createElement('canvas');
            const startY = Math.floor(canvas.height * SIGNATURE_START_RATIO);
            const endY = Math.floor(canvas.height * SIGNATURE_END_RATIO);
            const height = endY - startY;
            sigCanvas.width = canvas.width;
            sigCanvas.height = height;
            const sigCtx = sigCanvas.getContext('2d')!;
            sigCtx.drawImage(
                canvas,
                0,
                startY,
                canvas.width,
                height,
                0,
                0,
                canvas.width,
                height
            );

            const imageDataUrl = sigCanvas.toDataURL('image/png');

            if (abortedRef.current) return;

            setResults((prev) => {
                const next = new Map(prev);
                next.set(job.companyNumber, {
                    companyNumber: job.companyNumber,
                    companyName: job.companyName,
                    pdfUrl: job.pdfUrl,
                    imageDataUrl,
                    loading: false,
                    error: null,
                });
                return next;
            });
        } catch (err) {
            if (abortedRef.current) return;

            setResults((prev) => {
                const next = new Map(prev);
                next.set(job.companyNumber, {
                    companyNumber: job.companyNumber,
                    companyName: job.companyName,
                    pdfUrl: job.pdfUrl,
                    imageDataUrl: null,
                    loading: false,
                    error: err instanceof Error ? err.message : 'Extraction failed',
                });
                return next;
            });
        } finally {
            activeCountRef.current--;
            if (!abortedRef.current) {
                processNext();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const extractBatch = useCallback(
        (items: ExtractionJob[]) => {
            abortedRef.current = false;

            // Set all to loading state
            setResults((prev) => {
                const next = new Map(prev);
                for (const item of items) {
                    next.set(item.companyNumber, {
                        companyNumber: item.companyNumber,
                        companyName: item.companyName,
                        pdfUrl: item.pdfUrl,
                        imageDataUrl: null,
                        loading: true,
                        error: null,
                    });
                }
                return next;
            });

            queueRef.current.push(...items);

            // Kick off concurrent processing
            for (let i = 0; i < Math.min(MAX_CONCURRENT, items.length); i++) {
                processNext();
            }
        },
        [processNext]
    );

    const clearResults = useCallback(() => {
        abortedRef.current = true;
        queueRef.current = [];
        activeCountRef.current = 0;
        setResults(new Map());
    }, []);

    return { results, extractBatch, clearResults };
}
