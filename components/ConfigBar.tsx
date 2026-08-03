import React, { useState } from 'react';
import { Moon, Sun, Info } from 'lucide-react';
import { AboutPage } from './AboutPage';

interface Props {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const ConfigBar: React.FC<Props> = ({ theme, toggleTheme }) => {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const iconBtn =
    'w-7 h-7 grid place-items-center border border-rule text-ink-mid hover:border-ink-mid hover:text-ink transition-colors';

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-40 bg-paper border-b border-rule">
        <div className="h-[52px] flex items-center gap-3.5 px-[18px]">
          {/* Hanko + wordmark */}
          <div
            className="w-[30px] h-[30px] grid place-items-center flex-shrink-0 bg-accent text-accent-ink"
            style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 17, boxShadow: 'inset 0 0 14px oklch(0 0 0/.22)' }}
            aria-hidden="true"
          >
            見
          </div>
          <div className="flex items-baseline gap-2">
            <span style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 18 }}>Mitsuketa</span>
            <span className="text-ink-mid" style={{ fontFamily: 'var(--serif)', fontSize: 11, letterSpacing: '.24em' }}>
              見つけた
            </span>
          </div>

          <div className="flex-1" />

          {/* MBIE disclaimer link */}
          <button
            onClick={() => setIsAboutOpen(true)}
            className="hidden md:block text-ink-mid underline decoration-rule hover:text-ink transition-colors"
            style={{ fontSize: 11 }}
            title="View Data Source & Terms of Use"
          >
            Data sourced from MBIE registers. Not for unlawful commercial use.
          </button>

          {/* Register status */}
          <div className="hidden sm:flex items-center gap-1.5 text-ink-mid" style={{ fontSize: 11.5 }}>
            <span className="w-[7px] h-[7px] bg-green inline-block" aria-hidden="true" />
            Registers · connected
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setIsAboutOpen(true)} className={iconBtn} aria-label="About Mitsuketa" title="About Mitsuketa">
              <Info size={15} strokeWidth={1.5} />
            </button>
            <button onClick={toggleTheme} className={iconBtn} aria-label="Toggle theme" title="Toggle theme">
              {theme === 'dark' ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </div>

      {isAboutOpen && <AboutPage onClose={() => setIsAboutOpen(false)} />}
    </>
  );
};
