import React, { useEffect, useRef, useState } from 'react';

export const GraphScopeControl: React.FC<{
    scope: 'simple' | 'comprehensive'; name: string; busy: boolean; onRun: () => Promise<void>;
}> = ({ scope, name, busy, onRun }) => {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const confirm = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!open) return;
        confirm.current?.focus();
        const dismiss = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('pointerdown', dismiss);
        return () => document.removeEventListener('pointerdown', dismiss);
    }, [open]);
    const content = <><span className="sumi-tool-mark" aria-hidden="true">{scope === 'simple' ? '一' : '網'}</span>
        <span><strong>{scope === 'simple' ? 'Simple' : 'Comprehensive'}</strong><small>{scope === 'simple' ? 'Immediate relationships' : 'Wider network'}</small></span>
        {scope === 'simple' && <span className="sumi-tool-arrow" aria-hidden="true">↗</span>}</>;
    return <div className="sumi-scope" ref={root} onKeyDown={e => {
        if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    }}>
        {scope === 'simple' ? <button ref={trigger} className="sumi-graph-tool" disabled={busy} aria-expanded={open}
            aria-label="Simple · immediate relationships" onClick={() => setOpen(!open)}>{content}</button>
            : <div className="sumi-graph-tool" aria-label="Comprehensive · wider network">{content}</div>}
        {open && <section className="sumi-scope-prompt" aria-label="Run comprehensive search?">
            <p className="sumi-eyebrow">一 → 網 · Search scope</p>
            <h3>Follow the wider network?</h3>
            <p>Re-run <strong>{name}</strong> with ownership chains, subsidiaries and related entities. This can take longer.</p>
            <div className="sumi-prompt-actions">
                <button ref={confirm} className="sumi-primary" disabled={busy} onClick={() => { setOpen(false); trigger.current?.focus(); void onRun(); }}>Run comprehensive search <span aria-hidden="true">↗</span></button>
                <button className="sumi-text-action" onClick={() => { setOpen(false); trigger.current?.focus(); }}>Keep simple</button>
            </div>
        </section>}
    </div>;
}
