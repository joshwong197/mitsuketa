import React, { useState } from 'react';
import { Settings, Lock, Eye, EyeOff, Save, Moon, Sun, X, Info, Shield } from 'lucide-react';
import { ApiConfig } from '../types';
import { AboutPage } from './AboutPage';

interface Props {
  config: ApiConfig;
  onConfigChange: (newConfig: ApiConfig) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const ConfigBar: React.FC<Props> = ({ config, onConfigChange, theme, toggleTheme }) => {
  const [showKeys, setShowKeys] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const handleSave = () => {
    onConfigChange(localConfig);
    setIsSettingsOpen(false);
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 p-4 shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Eye className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent flex items-baseline gap-2">
              Mitsuketa <span className="text-sm font-normal text-slate-500 dark:text-slate-400">見つけた</span>
            </h1>
          </div>

          <button
            onClick={() => setIsAboutOpen(true)}
            className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer hidden md:block"
            title="View Data Source & Terms of Use"
          >
            Data sourced from MBIE registers. Not for unlawful commercial use.
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAboutOpen(true)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="About Mitsuketa"
            >
              <Info size={20} />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Settings size={20} className="text-blue-600" />
                Settings
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {/* Data Source & Terms of Use */}
              <div className="mb-6 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-4 border-l-4 border-amber-500">
                <h3 className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-500 mb-2">
                  <Shield size={16} /> Data Source & Terms of Use
                </h3>
                <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed mb-2">
                  All data is sourced from publicly accessible New Zealand Government registers (NZBN, Companies Office,
                  Insolvency Register, Disqualified Directors) administered by MBIE.
                  Mitsuketa does not guarantee the accuracy or completeness of this data.
                  This tool is provided for informational and analytical purposes only.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">API Keys</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2 mb-3">
                  Mitsuketa works out of the box — no API keys required. If you have your own MBIE API keys and want to track your own usage, you can add them here.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">NZBN API Key</label>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2.5 rounded-md border border-slate-200 dark:border-slate-700">
                      <Lock size={14} className="text-gray-500 dark:text-gray-400 shrink-0" />
                      <input
                        type={showKeys ? "text" : "password"}
                        placeholder="Required for structure"
                        className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:outline-none w-full placeholder-gray-400 dark:placeholder-gray-500"
                        value={localConfig.nzbnKey}
                        onChange={(e) => setLocalConfig({ ...localConfig, nzbnKey: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">Companies API Key</label>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2.5 rounded-md border border-slate-200 dark:border-slate-700">
                      <Lock size={14} className="text-gray-500 dark:text-gray-400 shrink-0" />
                      <input
                        type={showKeys ? "text" : "password"}
                        placeholder="Required for roles"
                        className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:outline-none w-full placeholder-gray-400 dark:placeholder-gray-500"
                        value={localConfig.companiesKey}
                        onChange={(e) => setLocalConfig({ ...localConfig, companiesKey: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">Disqualified Directors Key</label>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2.5 rounded-md border border-slate-200 dark:border-slate-700">
                      <Lock size={14} className="text-gray-500 dark:text-gray-400 shrink-0" />
                      <input
                        type={showKeys ? "text" : "password"}
                        placeholder="Optional"
                        className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:outline-none w-full placeholder-gray-400 dark:placeholder-gray-500"
                        value={localConfig.disqualifiedDirectorsKey || ''}
                        onChange={(e) => setLocalConfig({ ...localConfig, disqualifiedDirectorsKey: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">Insolvency Register Key</label>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2.5 rounded-md border border-slate-200 dark:border-slate-700">
                      <Lock size={14} className="text-gray-500 dark:text-gray-400 shrink-0" />
                      <input
                        type={showKeys ? "text" : "password"}
                        placeholder="Optional"
                        className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:outline-none w-full placeholder-gray-400 dark:placeholder-gray-500"
                        value={localConfig.insolvencyKey || ''}
                        onChange={(e) => setLocalConfig({ ...localConfig, insolvencyKey: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-start mt-2">
                  <button
                    onClick={() => setShowKeys(!showKeys)}
                    className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {showKeys ? <><EyeOff size={14} /> Hide Keys</> : <><Eye size={14} /> Show Keys</>}
                  </button>
                </div>

                <div className="flex items-center justify-end mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md text-sm font-bold transition-all shadow-lg hover:shadow-xl shadow-blue-600/20 active:scale-95"
                  >
                    <Save size={16} />
                    Apply Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAboutOpen && (
        <AboutPage onClose={() => setIsAboutOpen(false)} />
      )}
    </>
  );
};