/**
 * Renders page 1 of a consent-form PDF and crops the band the signature sits in.
 *
 * The band ratios and the untyped render call are the build of record — pdfjs v5's
 * types want `canvas` but the runtime accepts `canvasContext`. Extracted here
 * because the same crop was already written twice (services/exportService.ts and
 * hooks/useSignatureExtractor.ts) and the individual page needed a third caller.
 *
 * pdfjs is imported dynamically so the ~450kB bundle is only paid for by callers
 * that actually want a signature.
 */
export const SIGNATURE_START_RATIO = 0.44;
export const SIGNATURE_END_RATIO = 0.66;

/** Resolves to a PNG data URL, or null if the PDF can't be read. Never throws. */
export async function renderSignatureCrop(pdfUrl: string): Promise<string | null> {
    try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport } as any).promise;

        const startY = Math.floor(canvas.height * SIGNATURE_START_RATIO);
        const height = Math.floor(canvas.height * SIGNATURE_END_RATIO) - startY;
        const crop = document.createElement('canvas');
        crop.width = canvas.width;
        crop.height = height;
        crop.getContext('2d')!.drawImage(canvas, 0, startY, canvas.width, height, 0, 0, canvas.width, height);

        return crop.toDataURL('image/png');
    } catch {
        return null;
    }
}
