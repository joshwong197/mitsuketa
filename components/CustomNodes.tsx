import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Building2, User, Users, AlertTriangle, Shield } from 'lucide-react';
import { NodeData } from '../types';

export const CompanyNode = memo(({ data, selected }: NodeProps<NodeData>) => {
  // Calculate dynamic width based on label length and badges
  const labelLength = data.label?.length || 0;

  // Extra width if badges exist
  let extraWidth = 0;
  if (data.isInExternalAdmin) extraWidth += 140;
  if (data.removalCommenced) extraWidth += 100;
  if (data.hasHistoricInsolvency) extraWidth += 160;

  const minWidth = 180;
  const maxWidth = 450;
  const dynamicWidth = Math.min(maxWidth, Math.max(minWidth, (labelLength * 8 + 60) + (extraWidth > 0 ? extraWidth / 1.5 : 0)));

  const isHighlighted = data.isHighlighted;
  const isTarget = data.isTarget;

  return (
    <div
      className={`
        rounded-lg shadow-lg border-2 transition-all duration-300 relative
        ${isTarget ? 'border-blue-600 dark:border-blue-400 ring-4 ring-blue-500/20' : ''}
        ${selected ? 'border-blue-400 ring-2 ring-blue-500/50' : 'border-slate-200 dark:border-slate-700'}
        ${isHighlighted ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-slate-800/90' : 'bg-white dark:bg-slate-900'}
      `}
      style={{ width: `${dynamicWidth}px` }}
    >
      {isTarget && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
          Target
        </div>
      )}

      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />

      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-md shrink-0 ${isTarget ? 'bg-blue-600 text-white' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'}`}>
            <Building2 size={20} />
          </div>
          <div className="overflow-hidden flex-1">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 break-words" title={data.label}>
              {data.label}
            </h3>
            <p className="text-xs text-blue-600 dark:text-blue-300 font-mono mt-0.5">
              {data.nzbn ? `NZBN: ${data.nzbn}` : 'Overseas / Unreg'}
            </p>
            {/* Status Badge */}
            <div className="flex flex-wrap gap-1 mt-2">
              {data.status && !data.isInExternalAdmin && (
                <span className={`
                  inline-block px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-full font-bold max-w-full truncate
                  ${data.status.toLowerCase().includes('registered')
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-400'}
                `} title={data.status}>
                  {data.status}
                </span>
              )}

              {/* Entity Type Badge (for non-company entities) */}
              {data.entityTypeDescription && data.entityTypeCode !== 'NZCompany' && (
                <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-full font-bold max-w-full truncate bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-400" title={data.entityTypeDescription}>
                  {data.entityTypeDescription}
                </span>
              )}

              {/* External Administration Alert */}
              {data.isInExternalAdmin && data.externalAdminType && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-800 shrink-0" title={data.externalAdminType}>
                  <AlertTriangle size={10} className="text-orange-600 dark:text-orange-400" />
                  <span className="text-[9px] font-bold text-orange-700 dark:text-orange-300">
                    {data.externalAdminType.toUpperCase()}
                  </span>
                </div>
              )}

              {/* Removal In Progress Alert */}
              {data.removalCommenced && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 shrink-0" title="Removal in Progress">
                  <Shield size={10} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300">
                    REMOVAL
                  </span>
                </div>
              )}

              {/* Historic Insolvency Flag (for removed companies) */}
              {data.hasHistoricInsolvency && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 shrink-0" title={`Previously in ${data.historicInsolvencyType}`}>
                  <AlertTriangle size={10} className="text-red-600 dark:text-red-400" />
                  <span className="text-[9px] font-bold text-red-700 dark:text-red-300">
                    PREV: {data.historicInsolvencyType?.toUpperCase() || 'INSOLVENT'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Descendants Badge (bottom-right) */}
      {data.hiddenDescendantCount && data.hiddenDescendantCount > 0 && (
        <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md border-2 border-white dark:border-slate-900">
          +{data.hiddenDescendantCount}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
});

export const PersonNode = memo(({ data, selected }: NodeProps<NodeData>) => {
  const isHighlighted = data.isHighlighted;

  return (
    <div className={`
      min-w-[180px] px-4 py-2 rounded-full shadow-lg border-2 transition-all duration-300 flex items-center gap-3
      ${selected ? 'border-green-400 ring-2 ring-green-500/50' : 'border-slate-200 dark:border-slate-700'}
      ${isHighlighted ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-slate-800/90' : 'bg-white dark:bg-slate-900'}
    `}>
      <Handle type="target" position={Position.Top} className="!bg-green-500" />

      <div className="p-1.5 bg-green-100 dark:bg-green-900/50 rounded-full">
        <User size={16} className="text-green-600 dark:text-green-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-200">{data.label}</p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">Individual</p>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-green-500" />
    </div>
  );
});

export const SummaryNode = memo(({ data, selected }: NodeProps<NodeData>) => {
  return (
    <div className={`
      w-[220px] px-3 py-2 rounded-md border-2 border-dashed transition-all duration-300 flex items-center gap-3
      ${selected ? 'border-gray-400' : 'border-gray-300 dark:border-gray-600'}
      bg-gray-50 dark:bg-gray-800/50 opacity-80 hover:opacity-100
    `}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      <div className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-md">
        <Users size={16} className="text-gray-600 dark:text-gray-400" />
      </div>
      <div>
        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">{data.label}</p>
        <p className="text-[9px] text-gray-500 dark:text-gray-400">Minor shareholders hidden</p>
      </div>
    </div>
  );
});