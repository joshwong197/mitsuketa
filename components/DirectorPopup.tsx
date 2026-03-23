import React from 'react';
import { X, User, Building2 } from 'lucide-react';

interface DirectorPopupProps {
    companyName: string;
    directors: Array<{
        firstName?: string;
        lastName?: string;
        middleName?: string;
        fullName?: string;
        appointmentDate?: string;
        designation?: string;
        isCorporate?: boolean;
    }>;
    position: { x: number; y: number };
    onClose: () => void;
}

export const DirectorPopup: React.FC<DirectorPopupProps> = ({
    companyName,
    directors,
    position,
    onClose
}) => {
    return (
        <>
            {/* Backdrop for close */}
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            />

            {/* Popup Box */}
            <div
                className="fixed z-50 bg-white dark:bg-slate-800 rounded-xl shadow-soft-lg dark:shadow-dark-soft-lg border border-slate-200 dark:border-slate-700 w-80 max-h-96 overflow-hidden flex flex-col"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                }}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                            Directors
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">{companyName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Directors List */}
                <div className="overflow-y-auto flex-1 p-2">
                    {directors.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">
                            No active directors found
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {directors.map((director, index) => (
                                <div
                                    key={index}
                                    className="p-2 rounded bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <div className="flex items-start gap-2">
                                        {director.isCorporate ? (
                                            <Building2 className="text-blue-500 shrink-0 mt-0.5" size={14} />
                                        ) : (
                                            <User className="text-green-500 shrink-0 mt-0.5" size={14} />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                                {director.fullName || 'Unknown'}
                                            </p>
                                            {director.appointmentDate && (
                                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                                    Since: {new Date(director.appointmentDate).toLocaleDateString()}
                                                </p>
                                            )}
                                            {director.isCorporate && (
                                                <p className="text-xs text-blue-600 dark:text-blue-400">Corporate Director</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                        {directors.length} director{directors.length !== 1 ? 's' : ''} found
                    </p>
                </div>
            </div>
        </>
    );
};
