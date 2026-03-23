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
                    className="bg-white dark:bg-slate-900 rounded-lg shadow-soft-lg dark:shadow-dark-soft-lg max-w-md w-full mx-4 border-2 border-orange-500 dark:border-orange-400"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                                    <AlertTriangle className="text-orange-600 dark:text-orange-400" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                        Load Org Chart?
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                        This action will switch views
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onCancel}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-6">
                        <p className="text-slate-700 dark:text-slate-300 mb-4">
                            This will load the full organizational chart for:
                        </p>

                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-3">
                            <Building2 className="text-blue-600 dark:text-blue-400" size={20} />
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {companyName}
                            </p>
                        </div>

                        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                ℹ️ Your current person search will be saved as a snapshot for easy access later.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3 justify-end">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors font-medium flex items-center gap-2"
                        >
                            Load Chart
                            <Building2 size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
