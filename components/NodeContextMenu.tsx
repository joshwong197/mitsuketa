import React from 'react';
import { Users, Maximize2, Eye, Minimize2, ExternalLink, PenLine } from 'lucide-react';

interface NodeContextMenuProps {
    nodeId: string;
    nodeLabel: string;
    nodeType: string;
    nzbn?: string;
    isCapped?: boolean;
    sourceRegisterUniqueId?: string; // NZCN - Company number
    position: { x: number; y: number };
    onClose: () => void;
    onRecenter: (nodeId: string, nzbn: string, label: string) => void;
    onHideParents: (nodeId: string) => void;
    onShowAll: () => void;
    onShowDirectors: (nodeId: string, nzbn: string, label: string) => void;
    onExpandStructure: (nodeId: string, nzbn: string, label: string) => void;
    onCollapseBranch: (nodeId: string, nzbn: string, label: string) => void;
    onSearchPerson: (name: string) => void;
    onAddNote: (nodeId: string, nodeLabel: string, nzbn?: string) => void;
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
    nodeId,
    nodeLabel,
    nodeType,
    nzbn,
    isCapped,
    sourceRegisterUniqueId,
    position,
    onClose,
    onRecenter,
    onHideParents,
    onShowAll,
    onShowDirectors,
    onExpandStructure,
    onCollapseBranch,
    onSearchPerson,
    onAddNote,
}) => {
    const menuItems = [
        {
            icon: PenLine,
            label: 'Add note',
            onClick: () => {
                onAddNote(nodeId, nodeLabel, nzbn);
                // onAddNote closes the menu itself (it reuses the menu position
                // for the editor) — no onClose() here.
            },
        },
        {
            icon: ExternalLink,
            label: 'View on Register',
            onClick: () => {
                if (sourceRegisterUniqueId) {
                    window.open(`https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/${sourceRegisterUniqueId}`, '_blank');
                }
                onClose();
            },
            disabled: !sourceRegisterUniqueId,
            description: 'Open company page on Companies Office website'
        },
        {
            icon: Eye,
            label: 'Show All',
            onClick: () => {
                onShowAll();
                onClose();
            },
        },
        {
            icon: Users,
            label: 'Show Directors',
            onClick: () => {
                if (nzbn) onShowDirectors(nodeId, nzbn, nodeLabel);
                onClose();
            },
            disabled: !nzbn,
        },
        {
            icon: Maximize2,
            label: isCapped ? 'Fetch & Expand Structure' : 'Expand Full Structure',
            onClick: () => {
                if (nzbn) onExpandStructure(nodeId, nzbn, nodeLabel);
                onClose();
            },
            disabled: !nzbn,
        },
        {
            icon: Minimize2,
            label: 'Collapse Branch',
            onClick: () => {
                if (nzbn) onCollapseBranch(nodeId, nzbn, nodeLabel);
                onClose();
            },
            disabled: !nzbn,
            hide: nodeType !== 'companyNode' && nodeType !== 'summaryNode',
        },
        {
            icon: Users,
            label: 'Search as Individual',
            onClick: () => {
                onSearchPerson(nodeLabel);
                onClose();
            },
            hide: nodeType !== 'personNode',
        }
    ];

    const visibleItems = menuItems.filter(item => !item.hide);

    return (
        <>
            {/* Backdrop to close menu */}
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            />

            {/* Context Menu */}
            <div
                className="fixed z-50 bg-paper border border-rule py-1 min-w-[200px]"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                }}
            >
                {/* Header */}
                <div className="px-3 py-2 border-b border-rule">
                    <p className="text-xs font-semibold text-ink truncate">
                        {nodeLabel}
                    </p>
                    {nzbn && (
                        <p className="text-[10px] text-ink-mid" style={{ fontFamily: 'var(--mono)' }}>
                            {nzbn}
                        </p>
                    )}
                </div>

                {/* Menu Items */}
                <div className="py-1">
                    {visibleItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={index}
                                onClick={item.onClick}
                                disabled={item.disabled}
                                className={`
                  w-full px-3 py-2 text-left text-sm flex items-center gap-2
                  transition-colors
                  ${item.disabled
                                        ? 'text-ink-pale cursor-not-allowed'
                                        : 'text-ink hover:bg-paper2 hover:text-accent'
                                    }
                `}
                            >
                                <Icon size={14} strokeWidth={1.5} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
};
