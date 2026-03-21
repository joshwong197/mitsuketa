import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    X,
    MapPin,
    Check,
    AlertTriangle,
    PenTool,
    Building2,
    Calendar,
    Loader2,
    Eye,
    FileText,
    CheckCircle,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Focus,
    Download,
    ChevronLeft,
    Shield,
} from 'lucide-react';
import { PersonCompanyResult, PhysicalAddress } from '../types';
import { useConsentForms, ConsentFormLink } from '../hooks/useConsentForms';
import { useSignatureExtractor, SignatureExtractionResult } from '../hooks/useSignatureExtractor';

interface KydVerificationPanelProps {
    personName: string;
    results: PersonCompanyResult[];
    onClose: () => void;
}

// PDF Viewer Modal (ported from KYD — no changes to rendering logic)
function PdfViewerModal({
    url,
    companyName,
    onClose,
}: {
    url: string;
    companyName: string;
    onClose: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scale, setScale] = useState(1.0);
    const [autoZoomed, setAutoZoomed] = useState(false);
    const [pageCount, setPageCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const pdfDocRef = useRef<any>(null);
    const baseScaleRef = useRef(1.0);

    const renderPage = useCallback(
        async (pageNum: number, renderScale: number) => {
            if (!pdfDocRef.current || !canvasRef.current) return;
            try {
                const page = await pdfDocRef.current.getPage(pageNum);
                const viewport = page.getViewport({ scale: renderScale });
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: ctx, viewport }).promise;
                setCurrentPage(pageNum);
            } catch (err) {
                console.error('Page render error:', err);
            }
        },
        []
    );

    useEffect(() => {
        let cancelled = false;
        async function loadPdf() {
            setLoading(true);
            setError(null);
            try {
                const pdfjsLib = await import('pdfjs-dist');
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
                const pdf = await pdfjsLib.getDocument(url).promise;
                if (cancelled) return;
                pdfDocRef.current = pdf;
                setPageCount(pdf.numPages);
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1.0 });
                const containerWidth = containerRef.current?.clientWidth || 800;
                const fitScale = (containerWidth - 32) / viewport.width;
                baseScaleRef.current = fitScale;
                setScale(fitScale);
                await renderPage(1, fitScale);
                setLoading(false);
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load PDF');
                setLoading(false);
            }
        }
        loadPdf();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);

    useEffect(() => {
        if (!loading && pdfDocRef.current) {
            renderPage(currentPage, scale);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scale]);

    const handleAutoZoom = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const container = canvas.parentElement;
        if (!container) return;
        if (autoZoomed) {
            container.scrollTop = 0;
            setAutoZoomed(false);
        } else {
            const signatureY = canvas.height * 0.6;
            container.scrollTop = signatureY;
            setAutoZoomed(true);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            Consent Form
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{companyName}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setScale((s) => Math.max(baseScaleRef.current * 0.5, s - baseScaleRef.current * 0.25))}
                            className="h-7 w-7 p-0 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-gray-500 dark:text-gray-300 w-12 text-center">
                            {Math.round((scale / baseScaleRef.current) * 100)}%
                        </span>
                        <button
                            onClick={() => setScale((s) => Math.min(baseScaleRef.current * 3, s + baseScaleRef.current * 0.25))}
                            className="h-7 w-7 p-0 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleAutoZoom}
                            className="h-7 px-2 flex items-center gap-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-gray-700 dark:text-gray-200"
                            title={autoZoomed ? 'Show full page' : 'Auto-zoom to signature area'}
                        >
                            {autoZoomed ? <Maximize2 className="w-4 h-4" /> : <Focus className="w-4 h-4" />}
                            <span className="hidden sm:inline">{autoZoomed ? 'Full Page' : 'Signature'}</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="h-7 w-7 p-0 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div ref={containerRef} className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-950">
                    {loading && (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                            <span className="ml-2 text-sm text-gray-500">Loading PDF...</span>
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center justify-center h-64 text-red-500 text-sm">{error}</div>
                    )}
                    <canvas ref={canvasRef} className={`mx-auto shadow-lg ${loading ? 'hidden' : ''}`} />
                </div>

                {/* Footer */}
                {pageCount > 1 && (
                    <div className="flex items-center justify-center gap-2 p-2 border-t border-slate-200 dark:border-slate-700">
                        <button
                            disabled={currentPage <= 1}
                            onClick={() => renderPage(currentPage - 1, scale)}
                            className="h-7 px-3 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="text-xs text-gray-500">
                            Page {currentPage} of {pageCount}
                        </span>
                        <button
                            disabled={currentPage >= pageCount}
                            onClick={() => renderPage(currentPage + 1, scale)}
                            className="h-7 px-3 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Address Comparison Section (ported from KYD — same logic)
function AddressComparison({ results }: { results: PersonCompanyResult[] }) {
    const entries = results.filter(
        (r) => r.physicalAddress?.addressLines?.length
    );

    if (entries.length < 2) return null;

    // Group by unique address
    const addrMap = new Map<string, { address: string; fullAddress: string; companies: string[]; isActive: boolean }>();
    for (const r of entries) {
        const addr = r.physicalAddress!.addressLines.join(', ');
        const full = addr + (r.physicalAddress!.postCode ? `, ${r.physicalAddress!.postCode}` : '');
        const key = addr.toLowerCase().replace(/\s+/g, ' ');

        if (addrMap.has(key)) {
            const existing = addrMap.get(key)!;
            existing.companies.push(r.companyName);
            if ((r.entityStatusCode || 0) < 80 && !r.isInactive) existing.isActive = true;
        } else {
            addrMap.set(key, {
                address: addr,
                fullAddress: full,
                companies: [r.companyName],
                isActive: (r.entityStatusCode || 0) < 80 && !r.isInactive,
            });
        }
    }

    const unique = Array.from(addrMap.values());
    const allMatch = unique.length === 1;

    return (
        <div className="p-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Address Comparison
                </span>
                {allMatch ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <Check className="w-3 h-3" />
                        All match
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        {unique.length} different addresses
                    </span>
                )}
            </div>

            <div className="space-y-1.5">
                {unique.map((entry, idx) => (
                    <div
                        key={`addr-${idx}`}
                        className={`text-xs p-2 rounded ${!allMatch ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
                    >
                        <div className="text-gray-700 dark:text-gray-300 font-medium">
                            {entry.fullAddress}
                        </div>
                        <div className="text-gray-400 dark:text-gray-500 mt-0.5">
                            Used by {entry.companies.length} compan{entry.companies.length === 1 ? 'y' : 'ies'}
                            {entry.companies.length <= 3 && (
                                <span>: {entry.companies.join(', ')}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export const KydVerificationPanel: React.FC<KydVerificationPanelProps> = ({
    personName,
    results,
    onClose,
}) => {
    const { consentState, fetchForDirector, resetConsent } = useConsentForms();
    const { results: signatureResults, extractBatch, clearResults } = useSignatureExtractor();
    const [pdfViewer, setPdfViewer] = useState<{ url: string; companyName: string } | null>(null);
    const hasStartedRef = useRef(false);

    // Get firstName/lastName from the first result that has them
    const firstName = results.find((r) => r.firstName)?.firstName || '';
    const lastName = results.find((r) => r.lastName)?.lastName || '';

    // Active companies with company numbers for consent form lookup
    const activeCompanies = results.filter(
        (r) => r.companyNumber && (r.entityStatusCode || 0) < 80 && !r.isInactive
    );

    // Auto-fetch consent forms on mount
    useEffect(() => {
        if (hasStartedRef.current) return;
        if (!firstName || !lastName || activeCompanies.length === 0) return;

        hasStartedRef.current = true;
        fetchForDirector(
            firstName,
            lastName,
            activeCompanies.map((c) => ({
                companyNumber: c.companyNumber!,
                status: 'active',
            }))
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-extract signatures when consent forms are found
    useEffect(() => {
        if (consentState.loading || Object.keys(consentState.results).length === 0) return;

        const jobs: Array<{ companyNumber: string; companyName: string; pdfUrl: string }> = [];
        for (const [companyNumber, link] of Object.entries(consentState.results)) {
            if (!link) continue;
            const company = results.find((r) => r.companyNumber === companyNumber);
            if (!company) continue;
            jobs.push({
                companyNumber,
                companyName: company.companyName,
                pdfUrl: link.url,
            });
        }

        if (jobs.length > 0) {
            extractBatch(jobs);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [consentState.loading, consentState.results]);

    const handleViewPdf = (url: string, companyName: string) => {
        setPdfViewer({ url, companyName });
    };

    // Collect extracted signatures
    const extractedSignatures = Array.from(signatureResults.values()).filter(
        (r) => r.imageDataUrl !== null
    );
    const loadingCount = Array.from(signatureResults.values()).filter((r) => r.loading).length;

    return (
        <div className="absolute inset-0 flex flex-col bg-white dark:bg-slate-900 overflow-hidden z-50">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-900/20 dark:to-emerald-900/20 border-b border-slate-200 dark:border-slate-700">
                <button
                    onClick={onClose}
                    className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                    <ChevronLeft size={16} />
                    Back to results
                </button>

                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-blue-500 rounded-full">
                        <Shield className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            KYD Verification
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {personName} — {activeCompanies.length} active compan{activeCompanies.length === 1 ? 'y' : 'ies'}
                        </p>
                    </div>
                </div>

                {/* Status badges */}
                <div className="flex gap-2 mt-3 flex-wrap">
                    {consentState.loading && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-medium text-blue-700 dark:text-blue-300">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Fetching consent forms...
                        </span>
                    )}
                    {loadingCount > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-xs font-medium text-purple-700 dark:text-purple-300">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Extracting {loadingCount} signature{loadingCount !== 1 ? 's' : ''}...
                        </span>
                    )}
                    {!consentState.loading && extractedSignatures.length > 0 && loadingCount === 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            <PenTool className="w-3 h-3" />
                            {extractedSignatures.length} signature{extractedSignatures.length !== 1 ? 's' : ''} extracted
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Address Comparison */}
                <AddressComparison results={results} />

                {/* Signature Comparison */}
                {extractedSignatures.length > 0 && (
                    <div className="p-4 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                        <div className="flex items-center gap-2 mb-3">
                            <PenTool className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                Signature Comparison
                            </span>
                            <span className="text-xs text-blue-500 dark:text-blue-400">
                                {extractedSignatures.length} from active compan{extractedSignatures.length === 1 ? 'y' : 'ies'}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {extractedSignatures.map((sig) => (
                                <button
                                    key={`sig-cmp-${sig.companyNumber}`}
                                    onClick={() =>
                                        sig.pdfUrl && handleViewPdf(sig.pdfUrl, sig.companyName)
                                    }
                                    className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer text-left"
                                >
                                    <div className="px-2 py-1 bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate block">
                                            {sig.companyName}
                                        </span>
                                    </div>
                                    <div className="bg-white p-1 max-h-32 overflow-hidden">
                                        <img
                                            src={sig.imageDataUrl!}
                                            alt={`Signature from ${sig.companyName}`}
                                            className="w-full object-contain"
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Company Details with consent form status */}
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                        Companies ({activeCompanies.length} active)
                    </p>
                    <div className="space-y-3">
                        {activeCompanies.map((company) => {
                            const consentLink = company.companyNumber
                                ? consentState.results[company.companyNumber]
                                : null;
                            const sigResult = company.companyNumber
                                ? signatureResults.get(company.companyNumber)
                                : undefined;

                            return (
                                <div
                                    key={company.nzbn}
                                    className="p-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {company.companyName}
                                                </span>
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium shrink-0">
                                                    Active
                                                </span>
                                            </div>
                                            <div className="mt-1.5 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                                                {company.physicalAddress?.addressLines && (
                                                    <div className="flex items-start gap-1.5">
                                                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                                                        <span>
                                                            {company.physicalAddress.addressLines.join(', ')}
                                                            {company.physicalAddress.postCode &&
                                                                `, ${company.physicalAddress.postCode}`}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                                    Company #{company.companyNumber}
                                                </div>
                                            </div>

                                            {/* Consent form link */}
                                            {consentLink && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                                                    <button
                                                        onClick={() => handleViewPdf(consentLink.url, company.companyName)}
                                                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        View Consent Form
                                                    </button>
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Direct link
                                                    </span>
                                                </div>
                                            )}

                                            {/* Loading state for consent search */}
                                            {consentState.loading && !consentLink && (
                                                <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Searching for consent form...
                                                </div>
                                            )}
                                        </div>

                                        {/* Inline Signature */}
                                        {sigResult && (
                                            <div className="shrink-0 w-36">
                                                {sigResult.loading ? (
                                                    <div className="flex items-center justify-center h-16 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                                                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                                    </div>
                                                ) : sigResult.imageDataUrl ? (
                                                    <button
                                                        onClick={() =>
                                                            sigResult.pdfUrl &&
                                                            handleViewPdf(sigResult.pdfUrl, company.companyName)
                                                        }
                                                        className="block w-full rounded border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
                                                        title="Click to view full consent form"
                                                    >
                                                        <img
                                                            src={sigResult.imageDataUrl}
                                                            alt={`Signature for ${company.companyName}`}
                                                            className="w-full h-16 object-contain bg-white"
                                                        />
                                                        <div className="flex items-center justify-center gap-1 py-0.5 bg-slate-100 dark:bg-slate-900/50 text-xs text-gray-500 dark:text-gray-400">
                                                            <Eye className="w-3 h-3" />
                                                            View form
                                                        </div>
                                                    </button>
                                                ) : sigResult.error ? (
                                                    <div className="flex items-center justify-center h-16 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-xs text-red-500 px-1 text-center">
                                                        No form found
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* No active companies message */}
                {activeCompanies.length === 0 && (
                    <div className="text-center py-12">
                        <Building2 className="mx-auto mb-4 text-gray-300 dark:text-gray-600" size={48} />
                        <p className="text-gray-500 dark:text-gray-400">
                            No active companies with company numbers found for KYD verification
                        </p>
                    </div>
                )}

                {/* No consent forms found message */}
                {!consentState.loading &&
                    activeCompanies.length > 0 &&
                    Object.values(consentState.results).every((v) => v === null) &&
                    Object.keys(consentState.results).length > 0 && (
                        <div className="p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>No consent forms found for this director across active companies</span>
                            </div>
                        </div>
                    )}
            </div>

            {/* PDF Viewer Modal */}
            {pdfViewer && (
                <PdfViewerModal
                    url={pdfViewer.url}
                    companyName={pdfViewer.companyName}
                    onClose={() => setPdfViewer(null)}
                />
            )}
        </div>
    );
};
