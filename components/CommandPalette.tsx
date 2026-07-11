import React, { useEffect, useRef, useState } from 'react';

/**
 * Ctrl/Cmd+K command palette. Keyboard-first: opening steals focus to the
 * input, closing restores it. Commands are supplied by App at open time via
 * getCommands() (so recents are read fresh from localStorage), in ranked
 * groups: open tabs → recent searches → actions.
 */
export interface PaletteCommand {
  id: string;
  /** Group header text, e.g. "Open tabs". Groups render in first-seen order. */
  group: string;
  label: string;
  /** Right-aligned meta text (NZBN, mode, kanji marker). */
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  getCommands: () => PaletteCommand[];
}

/** NZBN/NZCN-shaped strings get mono + tabular numerals. */
const isIdentifier = (s: string) => /^\d[\d\s-]*$/.test(s.trim());

const MONO_STYLE: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontVariantNumeric: 'tabular-nums',
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, getCommands }) => {
  const [query, setQuery] = useState('');
  const [commands, setCommands] = useState<PaletteCommand[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Snapshot commands + steal focus on open; restore focus on close.
  const getCommandsRef = useRef(getCommands);
  getCommandsRef.current = getCommands;
  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement as HTMLElement | null;
      setCommands(getCommandsRef.current());
      setQuery('');
      setSelected(0);
      // Focus after paint so the input exists.
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (prevFocusRef.current) {
      prevFocusRef.current.focus?.();
      prevFocusRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? commands.filter(
        (c) => c.label.toLowerCase().includes(q) || (c.hint ?? '').toLowerCase().includes(q),
      )
    : commands;
  const sel = Math.min(selected, Math.max(filtered.length - 1, 0));

  const runCommand = (cmd: PaletteCommand) => {
    onClose();
    cmd.run();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // don't let App's global Escape handler also fire
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(filtered.length === 0 ? 0 : (sel + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(filtered.length === 0 ? 0 : (sel - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[sel]) runCommand(filtered[sel]);
    }
  };

  // Keep the selected row in view while arrowing.
  const scrollIntoView = (el: HTMLDivElement | null, isSel: boolean) => {
    if (el && isSel) el.scrollIntoView({ block: 'nearest' });
  };

  // Rows grouped by first-seen group order, flat index preserved for selection.
  const groups: { name: string; items: { cmd: PaletteCommand; index: number }[] }[] = [];
  filtered.forEach((cmd, index) => {
    const g = groups.find((x) => x.name === cmd.group);
    if (g) g.items.push({ cmd, index });
    else groups.push({ name: cmd.group, items: [{ cmd, index }] });
  });

  return (
    <div className="fixed inset-0 z-[90]" role="presentation">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes cmdk-settle { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
          .cmdk-panel { animation: cmdk-settle 120ms ease-out; }
        }
      `}</style>
      {/* click-away layer — flat wash, no blur */}
      <div className="absolute inset-0 bg-ink/10" onMouseDown={onClose} aria-hidden="true" />
      <div
        className="cmdk-panel relative mx-auto mt-[12vh] w-[min(560px,calc(100vw-32px))] border border-ink bg-paper"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-rule px-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            placeholder="Type a command or search…"
            className="w-full bg-transparent py-2.5 text-ink placeholder:text-ink-pale focus:outline-none"
            style={{ fontFamily: 'var(--gothic)', fontSize: 13 }}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-listbox"
            aria-activedescendant={filtered[sel] ? `cmdk-opt-${filtered[sel].id}` : undefined}
            aria-label="Command palette"
            autoComplete="off"
            spellCheck={false}
          />
          <span
            className="shrink-0 text-ink-pale"
            style={{ ...MONO_STYLE, fontSize: 10, letterSpacing: '0.08em' }}
          >
            ESC
          </span>
        </div>

        <div
          id="cmdk-listbox"
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          className="max-h-[46vh] overflow-y-auto py-1"
        >
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-ink-pale" style={{ fontSize: 13 }}>
              No matches.
            </div>
          )}
          {groups.map((group) => (
            <div key={group.name}>
              <div
                className="px-3 pb-1 pt-2 uppercase text-ink-pale"
                style={{ fontSize: 10, letterSpacing: '0.14em' }}
                aria-hidden="true"
              >
                {group.name}
              </div>
              {group.items.map(({ cmd, index }) => {
                const isSel = index === sel;
                return (
                  <div
                    key={cmd.id}
                    id={`cmdk-opt-${cmd.id}`}
                    ref={(el) => scrollIntoView(el, isSel)}
                    role="option"
                    aria-selected={isSel}
                    className={`flex cursor-pointer items-baseline gap-3 px-3 py-1.5 ${
                      isSel ? 'bg-paper2 text-ink' : 'text-ink-mid'
                    }`}
                    style={{
                      fontSize: 13,
                      borderLeft: `2px solid ${isSel ? 'var(--accent)' : 'transparent'}`,
                    }}
                    onMouseMove={() => setSelected(index)}
                    onMouseDown={(e) => e.preventDefault() /* keep focus in the input */}
                    onClick={() => runCommand(cmd)}
                  >
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={isIdentifier(cmd.label) ? MONO_STYLE : undefined}
                    >
                      {cmd.label}
                    </span>
                    {cmd.hint && (
                      <span
                        className="shrink-0 text-ink-pale"
                        style={
                          isIdentifier(cmd.hint)
                            ? { ...MONO_STYLE, fontSize: 10.5 }
                            : { fontSize: 10.5 }
                        }
                      >
                        {cmd.hint}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
