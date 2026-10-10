import type { RAGDocument } from '@/hooks/useOCCData';
import OCCTable, { StatusBadge } from './OCCTable';

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtBytes(bytes: number | null) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: 'text-red-300',
  txt: 'text-gray-300',
  md: 'text-blue-300',
  docx: 'text-blue-400',
  html: 'text-orange-300',
  url: 'text-green-300',
};

interface Props {
  docs: RAGDocument[];
}

export default function OCCRAGDocuments({ docs }: Props) {
  const indexed = docs.filter(d => d.status === 'indexed').length;
  const processing = docs.filter(d => d.status === 'processing').length;
  const failed = docs.filter(d => d.status === 'failed').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">RAG Documents</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Knowledge base files uploaded for retrieval-augmented generation.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {indexed > 0 && (
            <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
              {indexed} indexed
            </span>
          )}
          {processing > 0 && (
            <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full animate-pulse">
              {processing} processing
            </span>
          )}
          {failed > 0 && (
            <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
              {failed} failed
            </span>
          )}
        </div>
      </div>
      <OCCTable
        rows={docs}
        emptyMessage="No RAG documents uploaded yet."
        columns={[
          {
            key: 'created_at',
            label: 'Uploaded',
            sortable: true,
            width: 'w-36',
            render: r => <span className="text-gray-400">{fmt(r.created_at)}</span>,
          },
          {
            key: 'title',
            label: 'Title',
            render: r => (
              <span className="text-white truncate max-w-[200px] block" title={r.title}>
                {r.title}
              </span>
            ),
          },
          {
            key: 'file_type',
            label: 'Type',
            sortable: true,
            render: r => r.file_type ? (
              <span className={`uppercase font-bold text-[11px] ${FILE_TYPE_COLORS[r.file_type] ?? 'text-gray-300'}`}>
                {r.file_type}
              </span>
            ) : <span className="text-gray-600">—</span>,
          },
          {
            key: 'file_size_bytes',
            label: 'Size',
            sortable: true,
            render: r => <span className="text-gray-400">{fmtBytes(r.file_size_bytes)}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: r => <StatusBadge status={r.status} />,
          },
          {
            key: 'chunk_count',
            label: 'Chunks',
            sortable: true,
            render: r => r.chunk_count != null && r.chunk_count > 0
              ? <span className="text-purple-300">{r.chunk_count}</span>
              : '—',
          },
          {
            key: 'namespace',
            label: 'Namespace',
            sortable: true,
            render: r => <span className="text-blue-300">{r.namespace ?? 'default'}</span>,
          },
          {
            key: 'tags',
            label: 'Tags',
            render: r => r.tags && r.tags.length > 0
              ? (
                <div className="flex flex-wrap gap-1">
                  {r.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="bg-white/10 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">
                      {tag}
                    </span>
                  ))}
                  {r.tags.length > 3 && (
                    <span className="text-gray-500 text-[10px]">+{r.tags.length - 3}</span>
                  )}
                </div>
              )
              : <span className="text-gray-600">—</span>,
          },
        ]}
      />
    </div>
  );
}
