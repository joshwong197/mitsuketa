import React, { useEffect, useState } from 'react';

const valid = (value: unknown): value is string => typeof value === 'string'
    && !!value.trim() && value.length <= 100 && !/[\x00-\x1f\x7f]/.test(value);

export function MatterReference({ searcher, value, onChange, disabled }: {
    searcher: string; value: string; onChange: (value: string) => void; disabled: boolean;
}) {
    const key = `mitsuketa:matters:${encodeURIComponent(searcher.trim().toLowerCase())}`;
    const [saved, setSaved] = useState<string[]>([]);
    const [error, setError] = useState('');
    useEffect(() => {
        setSaved([]);
        setError('');
        try {
            const stored: unknown = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(stored)) setSaved([...new Set(stored.filter(valid).map(s => s.trim()))].slice(0, 50));
        } catch { setError('Saved references are unavailable in this browser. You can still enter a reference.'); }
    }, [key]);
    const update = (next: string[]) => {
        try { localStorage.setItem(key, JSON.stringify(next)); setSaved(next); setError(''); }
        catch { setError('Could not save this change in your browser. You can still search.'); }
    };
    const matter = value.trim();
    const exists = saved.includes(matter);
    const style = { border: '1px solid var(--rule)', padding: '9px 11px', fontSize: 13 };
    return <div style={{ marginBottom: 14 }}>
        <label htmlFor="matter-reference" className="block text-ink-mid"
            style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}>
            Matter reference (required)
        </label>
        {saved.length > 0 && <select aria-label="Saved matter references" disabled={disabled}
            className="w-full bg-paper text-ink" style={{ ...style, marginBottom: 7 }}
            value={exists ? matter : ''} onChange={event => onChange(event.target.value)}>
            <option value="">Enter a new reference</option>
            {saved.map(ref => <option key={ref} value={ref}>{ref}</option>)}
        </select>}
        <div className="flex flex-wrap gap-2">
            <input id="matter-reference" aria-label="Matter reference" required maxLength={100}
                className="bg-paper text-ink" style={{ ...style, minWidth: 0, flex: '1 1 180px' }}
                value={value} onChange={event => onChange(event.target.value)}
                placeholder="e.g. CASE-123" disabled={disabled} aria-describedby="matter-hint" />
            <button type="button" disabled={disabled || !valid(matter) || (!exists && saved.length >= 50)}
                className="text-accent" style={{ ...style, flexShrink: 0 }}
                onClick={() => update(exists ? saved.filter(ref => ref !== matter) : [...saved, matter])}>
                {exists ? 'Remove saved reference' : 'Save reference'}
            </button>
        </div>
        <p id="matter-hint" className="text-ink-pale" style={{ fontSize: 11, marginTop: 4 }}>
            Recorded with this search and its reports. Save up to 50 references for your username in this browser.
        </p>
        {error && <p role="status" style={{ fontSize: 12 }}>{error}</p>}
    </div>;
}
