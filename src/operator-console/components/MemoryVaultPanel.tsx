import { useNavigate } from 'react-router-dom';
import type { OperatorMemory } from '../operatorApi';

export function MemoryVaultPanel({ memory }: { memory: OperatorMemory }) {
  const navigate = useNavigate();

  return (
    <div className="operator-card large">
      <div className="operator-label">Memory Vault</div>
      <div className="operator-value">{memory.entries}</div>

      <p>
        Local-first operational memory with export-ready Markdown snapshots.
      </p>

      <div style={{ marginTop: 18, color: 'var(--operator-muted)' }}>
        <div>Vault: {memory.vaultPath}</div>
        <div>Mode: {memory.mode}</div>
        <div>Latest Export: {memory.lastExport ?? 'none yet'}</div>
      </div>

      <button
        type="button"
        className="operator-button"
        style={{ marginTop: 18, cursor: 'pointer' }}
        onClick={() => navigate('/occ')}
      >
        Open Memory Vault
      </button>
    </div>
  );
}

export default MemoryVaultPanel;
