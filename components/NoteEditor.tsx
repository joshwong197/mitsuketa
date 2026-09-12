import React, { useEffect, useRef, useState } from 'react';

/**
 * Inline case-note editor (Stage B, design/CASES_PLAN.md §Notes).
 * Rendered from App at the context-menu position — same fixed-position +
 * backdrop pattern as NodeContextMenu. bg-paper border-rule, radius 0,
 * no shadows (SUMI_SPEC §1). Textarea is body gothic at 12.5px.
 *
 * The flag toggle is the user's inkan mark (印, --accent) — "flagged by me",
 * an annotation, NOT a register status.
 */

const MAX_CHARS = 500; // soft cap — counter appears as you approach it

interface NoteEditorProps {
    nodeLabel: string;
    nzbn?: string;
    position: { x: number; y: number };
    initialText: string;
    initialFlag: boolean;
    hasExisting: boolean;
    onSave: (text: string, flag: boolean) => void;
    onDelete: () => void;
    onCancel: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
    nodeLabel,
    nzbn,
    position,
    initialText,
    initialFlag,
    hasExisting,
    onSave,
    onDelete,
    onCancel,
}) => {
    const [text, setText] = useState(initialText);
    const [flag, setFlag] = useState(initialFlag);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = textareaRef.current;
        if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
        }
    }, []);

    const save = () => onSave(text.trim(), flag);

    return (
        <>
            {/* Backdrop — click away cancels, like the context menu */}
            <div className="fixed inset-0 z-40" onClick={onCancel} />

            <div
                className="fixed z-50 bg-paper border border-rule w-[280px]"
                style={{ left: `${position.x}px`, top: `${position.y}px` }}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
                }}
            >
                {/* Header — same voice as the context menu header */}
                <div className="px-3 py-2 border-b border-rule flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold text-ink truncate">{nodeLabel}</p>
                    <span className="uppercase tracking-[.14em] text-ink-pale shrink-0" style={{ fontSize: 10 }}>
                        Note
                    </span>
                </div>

                <div className="p-3">
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                        rows={4}
                        placeholder={`Note on ${nzbn ? `NZBN ${nzbn}` : nodeLabel}…`}
                        className="w-full bg-paper border border-rule text-ink placeholder:text-ink-pale px-2 py-1.5 resize-none focus:outline-none focus:border-accent"
                        style={{ fontSize: 12.5, lineHeight: 1.5 }}
                    />
                    <div className="flex items-center justify-between mt-1.5">
                        {/* Inkan flag toggle — annotation mark, not register status */}
                        <button
                            onClick={() => setFlag((f) => !f)}
                            className="flex items-center gap-1.5 group"
                            title='Flagged by me — a personal mark, not a register status'
                            aria-pressed={flag}
                        >
                            <span
                                className="grid place-items-center shrink-0 rounded-full transition-colors"
                                style={{
                                    width: 18,
                                    height: 18,
                                    fontFamily: 'var(--serif)',
                                    fontSize: 10,
                                    lineHeight: 1,
                                    border: '1px solid var(--accent)',
                                    color: flag ? 'var(--accent-ink)' : 'var(--accent)',
                                    background: flag ? 'var(--accent)' : 'transparent',
                                }}
                            >
                                印
                            </span>
                            <span
                                className={`uppercase tracking-[.08em] transition-colors ${flag ? 'text-accent' : 'text-ink-pale group-hover:text-ink-mid'}`}
                                style={{ fontSize: 10 }}
                            >
                                {flag ? 'Flagged' : 'Flag'}
                            </span>
                        </button>
                        {text.length >= MAX_CHARS - 100 && (
                            <span className="text-ink-pale tabular-nums" style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                                {text.length}/{MAX_CHARS}
                            </span>
                        )}
                    </div>
                </div>

                {/* Footer actions */}
                <div className="px-3 py-2 border-t border-rule flex items-center gap-2">
                    {hasExisting && (
                        <button
                            onClick={onDelete}
                            className="text-ink-pale hover:text-crit transition-colors"
                            style={{ fontSize: 11.5 }}
                        >
                            Delete
                        </button>
                    )}
                    <span className="flex-1" />
                    <button
                        onClick={onCancel}
                        className="px-2.5 py-1 text-ink-mid hover:text-ink transition-colors"
                        style={{ fontSize: 12 }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={save}
                        className="px-3 py-1 bg-ink text-paper hover:bg-accent hover:text-accent-ink transition-colors"
                        style={{ fontSize: 12 }}
                    >
                        Save
                    </button>
                </div>
            </div>
        </>
    );
};
