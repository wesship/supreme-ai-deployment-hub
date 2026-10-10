import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface OCCTableProps<T extends { id: string }> {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  maxHeight?: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    indexed: 'bg-green-500/20 text-green-400 border-green-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    processing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    started: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    timeout: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    paused: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  const cls = map[status?.toLowerCase()] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status}
    </span>
  );
}

export { StatusBadge };

export default function OCCTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage = 'No data yet — waiting for production events.',
  maxHeight = '420px',
}: OCCTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey];
        const bv = (b as Record<string, unknown>)[sortKey];
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : rows;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <span className="text-gray-500 text-lg">∅</span>
        </div>
        <p className="text-sm text-gray-500">{emptyMessage}</p>
        <p className="text-xs text-gray-600 mt-1">
          Data will appear here once the backend is fully configured.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border border-white/10" style={{ maxHeight }}>
      <table className="w-full text-sm min-w-full">
        <thead className="sticky top-0 z-10 bg-[#0f1117] border-b border-white/10">
          <tr>
            {columns.map(col => (
              <th
                key={String(col.key)}
                className={`text-left text-xs text-gray-400 uppercase tracking-wider py-2.5 px-3 font-medium whitespace-nowrap ${col.width ?? ''} ${col.sortable ? 'cursor-pointer hover:text-gray-200 select-none' : ''}`}
                onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === String(col.key) && (
                    sortDir === 'asc'
                      ? <ChevronUp className="h-3 w-3" />
                      : <ChevronDown className="h-3 w-3" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.id}
              className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
            >
              {columns.map(col => (
                <td key={String(col.key)} className="py-2 px-3 text-gray-300 font-mono text-xs align-top">
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[String(col.key)] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
