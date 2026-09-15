import React, { useEffect, useRef } from 'react';

export function SnapshotNameDialog({ name, onChange, onSave, onCancel }: {
  name: string; onChange: (name: string) => void; onSave: () => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector('input')?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-5" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
    <form ref={dialog} role="dialog" aria-modal="true" aria-labelledby="snapshot-name-title"
      className="w-full max-w-md border border-ink bg-paper p-6 shadow-xl"
      onSubmit={e => { e.preventDefault(); onSave(); }} onKeyDown={e => {
        if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
        if (e.key !== 'Tab') return;
        const items = Array.from(dialog.current?.querySelectorAll('input, button:not([disabled])') || []) as HTMLElement[];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }}>
      <p className="sumi-eyebrow">写 · Keep this case</p>
      <h2 id="snapshot-name-title" className="text-ink mb-2" style={{ fontFamily: 'var(--serif)', fontSize: 25 }}>Save snapshot</h2>
      <p className="text-ink-mid mb-5" style={{ fontSize: 13 }}>Save the search and its notes in this workspace. You can download a copy later.</p>
      <label className="block text-ink-mid mb-2" htmlFor="snapshot-name" style={{ fontSize: 12 }}>Snapshot name</label>
      <input id="snapshot-name" value={name} onChange={e => onChange(e.target.value)} maxLength={200}
        className="w-full border border-rule bg-paper2 text-ink px-3 py-2 focus:outline-accent" />
      <div className="flex items-center justify-end gap-4 mt-6">
        <button type="button" className="sumi-text-action" onClick={onCancel}>Cancel</button>
        <button type="submit" className="sumi-primary" disabled={!name.trim()}>Save snapshot</button>
      </div>
    </form>
  </div>;
}
