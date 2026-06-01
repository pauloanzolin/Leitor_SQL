import { Handle, Position } from '@xyflow/react';
import { Key } from 'lucide-react';
import clsx from 'clsx';

export interface TableNodeData {
  name: string;
  columns: { name: string; type: string }[];
  primaryKeys: string[];
}

export default function TableNode({ data, selected }: { data: TableNodeData; selected: boolean }) {
  const { name, columns = [], primaryKeys = [] } = data;

  // Limit display to 15 columns for visual performance
  const displayCols = columns.slice(0, 15);
  const hasMore = columns.length > 15;

  return (
    <div
      className={clsx(
        'w-64 bg-slate-900 border-2 rounded-lg shadow-xl overflow-hidden transition-all duration-200',
        selected ? 'border-blue-400 shadow-blue-500/50' : 'border-slate-700 hover:border-slate-500'
      )}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />

      {/* Header */}
      <div className="bg-blue-600 px-3 py-2 flex items-center justify-center">
        <span className="font-bold text-white text-sm tracking-wide truncate">{name}</span>
      </div>

      {/* Columns */}
      <div className="flex flex-col text-xs font-mono">
        {displayCols.map((col, idx) => {
          const isPk = primaryKeys.includes(col.name);
          return (
            <div
              key={col.name}
              className={clsx(
                'flex items-center justify-between px-3 py-1.5 border-b border-slate-800 last:border-0',
                idx % 2 === 0 ? 'bg-slate-800/50' : 'bg-transparent'
              )}
            >
              <div className="flex items-center gap-2 truncate">
                {isPk ? (
                  <Key className="w-3 h-3 text-amber-500 flex-shrink-0" />
                ) : (
                  <div className="w-3 h-3 flex-shrink-0" /> // Spacer for alignment
                )}
                <span className={clsx('truncate', isPk ? 'text-amber-400 font-semibold' : 'text-slate-300')}>
                  {col.name}
                </span>
              </div>
              <span className="text-slate-500 flex-shrink-0 ml-2">{col.type}</span>
            </div>
          );
        })}
        {hasMore && (
          <div className="px-3 py-1.5 text-center text-slate-500 italic bg-slate-800/30">
            ... + {columns.length - 15} colunas
          </div>
        )}
      </div>
    </div>
  );
}
