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
            <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-paper z-50 flex flex-col border-l-2 border-accent transition-transform duration-300">
                {/* Header */}
                <div className="p-4 border-b border-rule flex items-center justify-between bg-paper2">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-accent" style={{ borderRadius: 999 }}>
                            <User className="text-accent-ink" size={18} strokeWidth={1.5} />
                        </div>
                        <div>
                            <h2 className="text-ink" style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 17 }}>Directors</h2>
                            <p className="text-xs text-ink-mid">
                                {directors.length} found
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-ink-mid hover:text-ink hover:bg-paper2 p-2 transition-colors"
                        aria-label="Close"
                    >
                        <ChevronLeft size={20} strokeWidth={1.5} />
                    </button>
                </div>

                {/* Company Name */}
                <div className="px-4 py-3 bg-paper2 border-b border-rule">
                    <p className="text-sm font-semibold text-ink truncate">{companyName}</p>
                </div>

                {/* Directors List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {directors.length === 0 ? (
                        <div className="text-center py-12 text-ink-mid">
                            <User size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
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
                                        className={`p-3 border border-rule bg-paper transition-all ${isActive ? '' : 'opacity-60'}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="p-1.5 mt-0.5 bg-paper2" style={{ borderRadius: 999 }}>
                                                <User size={14} strokeWidth={1.5} className={isActive ? 'text-green' : 'text-ink-pale'} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold text-ink truncate">
                                                        {fullName || 'Unknown Director'}
                                                    </p>
                                                    {dir.isCorporate && (
                                                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-paper2 text-ink-mid border border-rule">
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
                                                        className="shrink-0 p-1 hover:bg-paper2 text-accent transition-colors"
                                                        title={`Search for ${fullName}`}
                                                    >
                                                        <Search size={14} strokeWidth={1.5} />
                                                    </button>
                                                )}

                                                {dir.designation && (
                                                    <p className="text-xs text-ink-mid mt-0.5">
                                                        {dir.designation}
                                                    </p>
                                                )}

                                                {dir.appointmentDate && (
                                                    <p className="text-xs text-ink-mid mt-1">
                                                        <span className="font-medium">Appointed:</span> {new Date(dir.appointmentDate).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                    </p>
                                                )}

                                                {dir.resignationDate && (
                                                    <p className="text-xs text-crit mt-1 font-medium">
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
                <div className="p-4 border-t border-rule bg-paper2">
                    <p className="text-xs text-ink-mid text-center">
                        Data sourced from NZ Companies Office
                    </p>
                </div>
            </div>
        </>
    );
};
