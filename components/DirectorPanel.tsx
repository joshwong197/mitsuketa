import React from 'react';
import { X, User, ChevronLeft, Search } from 'lucide-react';

interface Director {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    fullName?: string;
    appointmentDate?: string;
    resignationDate?: string;
    designation?: string;
    isCorporate?: boolean;
}

interface DirectorPanelProps {
    companyName: string;
    directors: Director[];
    position: { x: number; y: number };
    onClose: () => void;
    onSearchPerson?: (name: string) => void;
}

export const DirectorPanel: React.FC<DirectorPanelProps> = ({
    companyName,
    directors,
    position,
    onClose,
    onSearchPerson,
}) => {
    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Slide-out Panel from Right */}
            <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l-2 border-blue-500 dark:border-blue-400 transition-transform duration-300">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-500 rounded-full">
                            <User className="text-white" size={18} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Directors</h2>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                {directors.length} found
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded p-2 transition-colors"
                        title="Close"
                    >
                        <ChevronLeft size={20} />
                    </button>
                </div>

                {/* Company Name */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{companyName}</p>
                </div>

                {/* Directors List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {directors.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <User size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">No directors found</p>
                            <p className="text-xs mt-1">This entity has no directors listed</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {directors.map((dir, idx) => {
                                const fullName = dir.fullName || `${dir.firstName || ''} ${dir.middleName || ''} ${dir.lastName || ''}`.trim();
                                const isActive = !dir.resignationDate;

                                return (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-lg border transition-all ${isActive
                                            ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60'
                                            }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className={`p-1.5 rounded-full mt-0.5 ${isActive
                                                ? 'bg-green-100 dark:bg-green-900/30'
                                                : 'bg-slate-200 dark:bg-slate-700'
                                                }`}>
                                                <User size={14} className={
                                                    isActive
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-slate-500 dark:text-slate-400'
                                                } />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                                        {fullName || 'Unknown Director'}
                                                    </p>
                                                    {dir.isCorporate && (
                                                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                                            CORP
                                                        </span>
                                                    )}
                                                </div>
                                                {onSearchPerson && !dir.isCorporate && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onSearchPerson(fullName);
                                                        }}
                                                        className="shrink-0 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                                        title={`Search for ${fullName}`}
                                                    >
                                                        <Search size={14} />
                                                    </button>
                                                )}

                                                {dir.designation && (
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                                        {dir.designation}
                                                    </p>
                                                )}

                                                {dir.appointmentDate && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        <span className="font-medium">Appointed:</span> {new Date(dir.appointmentDate).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                    </p>
                                                )}

                                                {dir.resignationDate && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium flex items-center gap-1">
                                                        <span className="sumi-status-mark sumi-status-mark--wash" aria-hidden="true">消</span>
                                                        <span>Resigned:</span> {new Date(dir.resignationDate).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}</div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        Data sourced from NZ Companies Office
                    </p>
                </div>
            </div>
        </>
    );
};
