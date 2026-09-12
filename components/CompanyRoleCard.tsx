import React from 'react';
import { Building2, Briefcase, TrendingUp, AlertTriangle, Shield } from 'lucide-react';
import { PersonCompanyResult } from '../types';

interface CompanyRoleCardProps {
    result: PersonCompanyResult;
    onClick: () => void;
}

export const CompanyRoleCard: React.FC<CompanyRoleCardProps> = ({ result, onClick }) => {
    const {
        companyName,
        nzbn,
        isDirector,
        shareholding,
        status,
        roleType,
        entityStatusCode,
        isInExternalAdmin,
        externalAdminType,
        removalCommenced,
        hasHistoricInsolvency,
        historicInsolvencyType,
        entityStatusDescription
    } = result;

    // Check if company is removed/inactive
    // First rely on the enriched NZBN status if available, fallback to the role search status code
    const isCompanyRemoved = entityStatusDescription
        ? entityStatusDescription.toLowerCase().includes('removed') || entityStatusDescription.toLowerCase() === 'inactive'
        : (entityStatusCode || 0) >= 80;

    // Format resignation date safely
    const formatResignationDate = (dateStr?: string): string | null => {
        if (!dateStr) return null;
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null; // Invalid date
            return date.toLocaleDateString();
        } catch {
            return null;
        }
    };

    const resignationDateFormatted = formatResignationDate(result.resignationDate);

    // Determine the display status text (enriched if available)
    const getDisplayStatus = () => {
        if (isInExternalAdmin && externalAdminType) {
            return externalAdminType.toUpperCase();
        }
        if (entityStatusDescription) {
            return entityStatusDescription.toUpperCase();
        }
        return status;
    };

    const getStatusBadgeClass = () => {
        if (isInExternalAdmin || isCompanyRemoved) {
            return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700 font-bold';
        }
        if (removalCommenced) {
            return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-bold';
        }
        if (status === 'REGISTERED') {
            return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold';
        }
        return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold';
    };

    return (
        <div
            onClick={onClick}
            className={`p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group ${isCompanyRemoved && !isInExternalAdmin ? 'opacity-60 hover:opacity-80' : ''
                }`}
        >
            {/* Company Header */}
            <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors ${isCompanyRemoved && !isInExternalAdmin ? 'blur-[0.5px]' : ''
                    }`}>
                    <Building2 className="text-blue-600 dark:text-blue-400" size={24} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className={`text-lg font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${isCompanyRemoved && !isInExternalAdmin ? 'line-through opacity-70' : ''
                        }`}>
                        {companyName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        NZBN: {nzbn}
                    </p>
                </div>
            </div>

            {/* Status Alerts */}
            <div className="space-y-1.5 mb-3">
                {/* Removal In Progress Alert */}
                {removalCommenced && !isCompanyRemoved && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <Shield size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                            📋 Removal in Progress
                        </span>
                    </div>
                )}

                {/* Historic Insolvency Flag (for removed companies) */}
                {isCompanyRemoved && hasHistoricInsolvency && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <AlertTriangle size={14} className="text-red-500 dark:text-red-400 flex-shrink-0" />
                        <span className="text-xs font-semibold text-red-600 dark:text-red-300">
                            Previously In {historicInsolvencyType ? historicInsolvencyType.replace(/^in\s+/i, '') : 'Insolvency'}
                        </span>
                    </div>
                )}
            </div>

            {/* Roles */}
            <div className="space-y-2 mb-3">
                {/* Director Badge */}
                {isDirector && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Briefcase size={16} className="text-purple-600 dark:text-purple-400" />
                            <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                                Director
                            </span>
                        </div>
                        {/* Resignation/Inactive Badge - More Prominent */}
                        {result.isInactive && (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700">
                                <span className="text-sm font-bold text-red-700 dark:text-red-300">
                                    ⚠ Resigned
                                </span>
                                {resignationDateFormatted && (
                                    <span className="text-xs text-red-600 dark:text-red-400">
                                        {resignationDateFormatted}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Shareholding Bar */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <TrendingUp size={14} className="text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                Shareholding
                            </span>
                        </div>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            {shareholding.toFixed(2)}%
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${shareholding > 0
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                                : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                            style={{ width: `${Math.min(100, shareholding)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusBadgeClass()}`}>
                    {getDisplayStatus()}
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400 group-hover:underline font-medium">
                    View org chart →
                </span>
            </div>
        </div>
    );
};
