import React, { useEffect, useState } from 'react';

type Target = { page: string; selector: string; text: string; viewport: string };
type Note = Target & { id: string; comment: string };
const key = 'mitsuketa-ui-review-v1';

function identify(element: Element): string {
  const parts: string[] = [];
  for (let current: Element | null = element; current && parts.length < 5; current = current.parentElement) {
    if (current.id) { parts.unshift(`#${CSS.escape(current.id)}`); break; }
    const siblings = current.parentElement ? [...current.parentElement.children].filter(e => e.tagName === current!.tagName) : [];
    parts.unshift(current.tagName.toLowerCase() + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : ''));
  }
  return parts.join(' > ');
}

export default function ReviewOverlay() {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(data) ? data.filter(n => n && ['id', 'page', 'selector', 'text', 'viewport', 'comment'].every(k => typeof n[k] === 'string')) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(notes)); }
    catch { setMessage('Browser storage is unavailable. Export your notes before closing this page.'); }
  }, [notes]);
  useEffect(() => {
    if (!picking) return;
    const outline = document.createElement('div');
    outline.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #6657df;background:#6657df18;';
    document.body.appendChild(outline);
    const move = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('[data-ui-review]')) { outline.hidden = true; return; }
      const box = event.target.getBoundingClientRect();
      outline.hidden = false;
      Object.assign(outline.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    };
    const select = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('[data-ui-review]')) return;
      event.preventDefault(); event.stopPropagation();
      const element = event.target;
      // Never capture field values, URL query parameters, or authentication tokens.
      setTarget({ page: location.pathname + location.hash.split('?')[0], selector: identify(element),
        text: (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 180),
        viewport: `${innerWidth} × ${innerHeight}` });
      setComment(''); setPicking(false); setOpen(true);
    };
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPicking(false); setOpen(true); } };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('click', select, true);
    document.addEventListener('keydown', cancel, true);
    return () => {
      outline.remove(); document.removeEventListener('pointermove', move, true);
      document.removeEventListener('click', select, true); document.removeEventListener('keydown', cancel, true);
    };
  }, [picking]);
  const exportNotes = () => {
    const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').replace(/`/g, "'");
    const markdown = '# Mitsuketa UI feedback\n\n' + notes.map((n, i) =>
      `## ${i + 1}. ${clean(n.text || 'Selected element')}\n\n- Page: ${clean(n.page)}\n- Viewport: ${n.viewport}\n- Element: \`${clean(n.selector)}\`\n\n${n.comment}\n`).join('\n');
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'mitsuketa-ui-feedback.md'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Markdown exported. Attach it here when ready.');
  };
  return <aside data-ui-review aria-label="UI review tools" style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 2147483647, color: '#222', font: '14px/1.5 system-ui, sans-serif' }}>
    <style>{`[data-ui-review] button { background:#f4f3fb; color:#29243d; border:1px solid #bdb9d0; border-radius:6px; padding:7px 11px; cursor:pointer; font:inherit; } [data-ui-review] button:disabled { opacity:.45; cursor:default; } [data-ui-review] button:focus-visible,[data-ui-review] textarea:focus-visible { outline:3px solid #6657df; outline-offset:2px; }`}</style>
    {picking ? <button onClick={() => { setPicking(false); setOpen(true); }}>Click an element · Escape to cancel</button>
      : !open ? <button onClick={() => setOpen(true)}>Annotate UI {notes.length ? `(${notes.length})` : ''}</button>
      : <div style={{ width: 'min(380px, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 32px)', overflow: 'auto', background: '#fff', border: '1px solid #bdb9d0', borderRadius: 10, padding: 16, boxShadow: '0 8px 36px #0003' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><strong>UI feedback</strong><button aria-label="Close review panel" onClick={() => setOpen(false)}>Close</button></div>
        <p style={{ margin: '12px 0' }}>Select something on the page and describe your change. Notes stay in this browser until you export them.</p>
        <button onClick={() => { setPicking(true); setOpen(false); setMessage(''); }}>Select an element</button>
        {target && <form onSubmit={e => { e.preventDefault(); if (!comment.trim()) return; setNotes([...notes, { ...target, id: crypto.randomUUID(), comment: comment.trim() }]); setTarget(null); setComment(''); setMessage('Note saved.'); }}>
          <p style={{ margin: '12px 0', overflowWrap: 'anywhere' }}><strong>Selected:</strong> {target.text || target.selector}</p>
          <label htmlFor="ui-review-comment">What should change?</label>
          <textarea id="ui-review-comment" autoFocus required value={comment} onChange={e => setComment(e.target.value)} rows={4} style={{ display: 'block', width: '100%', boxSizing: 'border-box', border: '1px solid #bdb9d0', borderRadius: 6, padding: 8, margin: '6px 0 10px', color: '#222', background: '#fff', font: 'inherit' }} />
          <button type="submit">Save note</button>{' '}<button type="button" onClick={() => setTarget(null)}>Discard draft</button>
        </form>}
        <ol style={{ paddingLeft: 22, margin: '14px 0' }}>{notes.map((n, i) => <li key={n.id} style={{ marginBottom: 12, overflowWrap: 'anywhere' }}>
          <strong>{n.text || 'Selected element'}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{n.comment}</p>
          <small>{n.page} · {n.viewport}</small><br />
          <button aria-label={`Edit note ${i + 1}`} onClick={() => { const change = window.prompt('Edit your comment', n.comment); if (change?.trim()) setNotes(notes.map(row => row.id === n.id ? { ...row, comment: change.trim() } : row)); }}>Edit</button>{' '}
          <button aria-label={`Delete note ${i + 1}`} onClick={() => setNotes(notes.filter(row => row.id !== n.id))}>Delete</button>
        </li>)}</ol>
        <button disabled={!notes.length} onClick={exportNotes}>Export Markdown ({notes.length})</button>
        {message && <p role="status" style={{ marginTop: 10 }}>{message}</p>}
      </div>}
  </aside>;
}
