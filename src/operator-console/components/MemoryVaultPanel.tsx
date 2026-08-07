import { BrainCircuit, Clock3, Database, FolderArchive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { OperatorMemory } from '../operatorApi';

export function MemoryVaultPanel({ memory }: { memory: OperatorMemory }) {
  const navigate = useNavigate();

  return (
    <div className="operator-card large d3-surface d3-glow-1 overflow-hidden">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="d3-kicker">Organizational continuity</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-400/[0.06] text-blue-200">
              <BrainCircuit className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-lg font-semibold text-white">Memory Vault</div>
              <div className="text-xs text-white/45">Local-first operational memory</div>
            </div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-3xl font-black text-white">{memory.entries}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-blue-100/45">stored entries</div>
        </div>
      </div>

      <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55">
        Durable operational context with export-ready Markdown snapshots, source-aware continuity, and a clear boundary between what the system remembers and where it is stored.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
          <FolderArchive className="h-4 w-4 text-blue-200/75" aria-hidden="true" />
          <div className="mt-3 text-[10px] uppercase tracking-[0.15em] text-white/35">Vault</div>
          <div className="mt-1 truncate text-xs font-medium text-white/75" title={memory.vaultPath}>{memory.vaultPath}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
          <Database className="h-4 w-4 text-blue-200/75" aria-hidden="true" />
          <div className="mt-3 text-[10px] uppercase tracking-[0.15em] text-white/35">Mode</div>
          <div className="mt-1 text-xs font-medium text-white/75">{memory.mode}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
          <Clock3 className="h-4 w-4 text-blue-200/75" aria-hidden="true" />
          <div className="mt-3 text-[10px] uppercase tracking-[0.15em] text-white/35">Latest export</div>
          <div className="mt-1 truncate text-xs font-medium text-white/75" title={memory.lastExport ?? 'none yet'}>{memory.lastExport ?? 'none yet'}</div>
        </div>
      </div>

      <button
        type="button"
        className="operator-button d3-command-surface mt-5 cursor-pointer"
        onClick={() => navigate('/occ')}
      >
        Open Memory Vault
      </button>
    </div>
  );
}

export default MemoryVaultPanel;
