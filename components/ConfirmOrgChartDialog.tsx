import React from 'react';
import { AlertTriangle, Building2, X } from 'lucide-react';

interface ConfirmOrgChartDialogProps {
    companyName: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmOrgChartDialog: React.FC<ConfirmOrgChartDialogProps> = ({
    companyName,
    onConfirm,
    onCancel
}) => {
    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
                onClick={onCancel}
            >
                {/* Dialog */}
                <div
                    className="bg-paper max-w-md w-full mx-4 border border-rule"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-rule">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-paper2">
                                    <AlertTriangle className="text-amber" size={24} strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h3 className="text-ink" style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 17 }}>
                                        Load Org Chart?
                                    </h3>
                                    <p className="text-sm text-ink-mid mt-0.5">
                                        This action will switch views
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onCancel}
                                className="text-ink-mid hover:text-ink transition-colors"
                                aria-label="Close"
                            >
                                <X size={20} strokeWidth={1.5} />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-6">
                        <p className="text-ink-mid mb-4">
                            This will load the full organizational chart for:
                        </p>

                        <div className="p-4 bg-paper2 border border-rule flex items-center gap-3">
                            <Building2 className="text-accent" size={20} strokeWidth={1.5} />
                            <p className="font-semibold text-ink">
                                {companyName}
                            </p>
                        </div>

                        <div className="mt-4 p-3 bg-paper2">
                            <p className="text-sm text-ink-mid">
                                Your current person search will be saved as a snapshot for easy access later.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-rule flex gap-3 justify-end">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-ink bg-paper border border-rule hover:border-ink-mid transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-4 py-2 bg-ink text-paper hover:bg-accent hover:text-accent-ink transition-colors font-medium flex items-center gap-2"
                        >
                            Load Chart
                            <Building2 size={16} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
