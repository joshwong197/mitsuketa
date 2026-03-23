import React from 'react';
import { Building2, User, X } from 'lucide-react';

interface TabItem {
    id: string;
    label: string;
    isLoading?: boolean;
}

interface TabBarProps {
    activeMainTab: 'company' | 'individual';
    onMainTabChange: (tab: 'company' | 'individual') => void;
    companyTabs: TabItem[];
    individualTabs: TabItem[];
    activeSubTabId: string | null;
    onSubTabClick: (tabId: string) => void;
    onSubTabClose: (tabId: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
    activeMainTab,
    onMainTabChange,
    companyTabs,
    individualTabs,
    activeSubTabId,
    onSubTabClick,
    onSubTabClose
}) => {
    const activeTabs = activeMainTab === 'company' ? companyTabs : individualTabs;

    return (
        <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            {/* Primary Category Tabs */}
            <div className="flex items-center gap-1 px-3 pt-2">
                <button
                    onClick={() => onMainTabChange('company')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold transition-all border border-b-0 ${activeMainTab === 'company'
                            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-slate-200 dark:border-slate-700 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                >
                    <Building2 size={16} />
                    Company
                    {companyTabs.length > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeMainTab === 'company'
                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            }`}>
                            {companyTabs.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => onMainTabChange('individual')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold transition-all border border-b-0 ${activeMainTab === 'individual'
                            ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 border-slate-200 dark:border-slate-700 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                >
                    <User size={16} />
                    Individual
                    {individualTabs.length > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeMainTab === 'individual'
                                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            }`}>
                            {individualTabs.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Sub-tabs (scrollable row) */}
            {activeTabs.length > 0 && (
                <div className="flex items-center gap-0.5 px-3 py-1 overflow-x-auto scrollbar-thin touch-pan-x">
                    {activeTabs.map(tab => (
                        <div
                            key={tab.id}
                            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all whitespace-nowrap max-w-[200px] ${activeSubTabId === tab.id
                                    ? activeMainTab === 'company'
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700'
                                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-700'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            onClick={() => onSubTabClick(tab.id)}
                        >
                            {activeMainTab === 'company'
                                ? <Building2 size={12} className="flex-shrink-0" />
                                : <User size={12} className="flex-shrink-0" />
                            }
                            <span className="truncate">
                                {tab.label}
                            </span>
                            {tab.isLoading && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSubTabClose(tab.id);
                                }}
                                className="ml-1 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
