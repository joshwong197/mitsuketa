import React from 'react';
import { X, Eye, Shield, Users, Building2, Map, ShieldAlert, BarChart3, Info } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export const AboutPage: React.FC<Props> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-slate-800 dark:to-slate-800/80">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <Eye className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent flex items-baseline gap-2">
                                Mitsuketa <span className="text-sm font-normal text-slate-500 dark:text-slate-400">見つけた</span>
                            </h2>
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic">"I found it."</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-8">

                    <section>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">A visual corporate investigation tool.</h3>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                            Mitsuketa is a powerful visual workspace designed for investigators, researchers, credit managers, and corporate analysts.
                            It automatically aggregates data from key New Zealand public registers to transform complex corporate landscapes into intuitive, interactive maps.
                        </p>
                    </section>

                    <section>
                        <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <BarChart3 className="text-blue-500" size={20} /> Features
                        </h4>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <Building2 className="text-blue-600 dark:text-blue-400" size={18} />
                                    <h5 className="font-semibold text-slate-800 dark:text-slate-200">Company Structures</h5>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Recursively crawls shareholding data to map full corporate webs—upstream parents, downstream subsidiaries, and sibling entities.
                                </p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <Users className="text-purple-600 dark:text-purple-400" size={18} />
                                    <h5 className="font-semibold text-slate-800 dark:text-slate-200">Individual Search</h5>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Find every company a person is associated with as a Director or Shareholder across the entire Companies Register.
                                </p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <ShieldAlert className="text-red-500 dark:text-red-400" size={18} />
                                    <h5 className="font-semibold text-slate-800 dark:text-slate-200">Risk Intelligence</h5>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Automatically flags companies in receivership or liquidation, removed entities, disqualified directors, and historic personal insolvency.
                                </p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <Map className="text-emerald-600 dark:text-emerald-400" size={18} />
                                    <h5 className="font-semibold text-slate-800 dark:text-slate-200">Interactive Maps</h5>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Pan, zoom, expand branches, and take snapshots. Save your investigation state or export as high-resolution PNG/PDF.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-lg border-l-4 border-amber-500">
                        <h4 className="flex items-center gap-2 text-amber-800 dark:text-amber-500 font-bold mb-2">
                            <Shield size={20} /> Data Source & Terms of Use
                        </h4>
                        <p className="text-sm text-amber-900/80 dark:text-amber-200/80 leading-relaxed mb-3">
                            All information displayed by Mitsuketa is sourced directly from publicly accessible
                            New Zealand Government registers administered by the Ministry of Business, Innovation and Employment (MBIE), including:
                        </p>
                        <ul className="list-disc pl-5 text-sm text-amber-900/80 dark:text-amber-200/80 mb-3 space-y-1">
                            <li>New Zealand Business Number (NZBN) Register</li>
                            <li>Companies Office Register</li>
                            <li>New Zealand Insolvency Register</li>
                            <li>Disqualified Directors Register</li>
                        </ul>
                        <p className="text-sm text-amber-900/80 dark:text-amber-200/80 font-medium">
                            Mitsuketa does not guarantee the accuracy, completeness, or timeliness of this data—MBIE provides this data "as is".
                            Users must not knowingly or recklessly use, or attempt to use, this information for any unlawful purpose.
                            This aggregate tool is provided for informational and analytical purposes only.
                        </p>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                        Mitsuketa — Built in New Zealand
                    </p>
                </div>
            </div>
        </div>
    );
};
