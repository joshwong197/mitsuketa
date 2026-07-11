import React from 'react';
import { Plus, X } from 'lucide-react';

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
    /** While true, a transient "New search" chip is the visually active tab. */
    searchViewOpen: boolean;
    onNewSearch: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
    activeMainTab,
    onMainTabChange,
    companyTabs,
    individualTabs,
    activeSubTabId,
    onSubTabClick,
    onSubTabClose,
    searchViewOpen,
    onNewSearch
}) => {
    const activeTabs = activeMainTab === 'company' ? companyTabs : individualTabs;

    const modeBtn = (mode: 'company' | 'individual', kanji: string, label: string) => {
        const current = activeMainTab === mode;
        return (
            <button
                onClick={() => onMainTabChange(mode)}
                className={`flex items-center gap-2 px-4 py-2.5 transition-colors ${current ? 'text-ink bg-paper2' : 'text-ink-pale hover:text-ink-mid'}`}
                style={{ fontSize: 12.5, boxShadow: current ? 'inset 0 -2px 0 var(--accent)' : undefined }}
            >
                <span
                    style={{ fontFamily: 'var(--serif)', fontSize: 11 }}
                    className={current ? 'text-accent' : 'text-ink-pale'}
                >
                    {kanji}
                </span>
                {label}
            </button>
        );
    };

    return (
        <div className="flex-shrink-0 bg-paper border-b border-rule">
            {/* Primary Category Tabs */}
            <div className="flex items-center">
                {modeBtn('company', '会社', 'Company')}
                {modeBtn('individual', '個人', 'Individual')}
            </div>

            {/* Sub-tabs (scrollable row) */}
            {(activeTabs.length > 0 || searchViewOpen) && (
                <div className="flex items-stretch overflow-x-auto border-t border-rule touch-pan-x">
                    {activeTabs.map(tab => {
                        const active = !searchViewOpen && activeSubTabId === tab.id;
                        return (
                            <div
                                key={tab.id}
                                className={`group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors whitespace-nowrap max-w-[220px] border-r border-rule ${active ? 'text-ink bg-paper2' : 'text-ink-pale hover:text-ink-mid'}`}
                                style={{ fontSize: 12 }}
                                onClick={() => onSubTabClick(tab.id)}
                            >
                                <span className="truncate">{tab.label}</span>
                                {tab.isLoading && (
                                    <span className="w-1.5 h-1.5 bg-accent animate-pulse flex-shrink-0" />
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSubTabClose(tab.id);
                                    }}
                                    aria-label="Close tab"
                                    className="ml-1 p-0.5 text-ink-pale hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                >
                                    <X size={11} strokeWidth={1.5} />
                                </button>
                            </div>
                        );
                    })}
                    {searchViewOpen ? (
                        /* Transient chip — exists only while the search view is open */
                        <div
                            className="flex items-center gap-1.5 px-3 py-1.5 whitespace-nowrap border-r border-rule text-ink bg-paper2"
                            style={{ fontSize: 12 }}
                        >
                            <span className="text-accent" style={{ fontFamily: 'var(--serif)', fontSize: 11 }}>新</span>
                            New search
                        </div>
                    ) : (
                        <button
                            onClick={onNewSearch}
                            aria-label="New search"
                            title="New search"
                            className="flex items-center px-3 py-1.5 border-r border-rule text-ink-pale hover:text-ink transition-colors flex-shrink-0"
                        >
                            <Plus size={13} strokeWidth={1.5} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
