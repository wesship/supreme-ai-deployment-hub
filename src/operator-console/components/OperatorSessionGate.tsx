import { FormEvent, ReactNode, useState } from 'react';

import {
  clearOperatorSession,
  hasOperatorSession,
  loadOperatorSession,
  saveOperatorSession,
} from '../operatorSession';

export function OperatorSessionGate({ children }: { children: ReactNode }) {
  const [sessionActive, setSessionActive] = useState(hasOperatorSession());
  const [role, setRole] = useState(loadOperatorSession()?.role ?? 'operator');
  const [token, setToken] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token.trim()) return;
    saveOperatorSession(token.trim(), role.trim() || 'operator');
    setToken('');
    setSessionActive(true);
  }

  function handleLogout() {
    clearOperatorSession();
    setSessionActive(false);
  }

  if (sessionActive) {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            right: 24,
            top: 24,
            zIndex: 20,
          }}
        >
          <button className="operator-pill" onClick={handleLogout} type="button">
            End Operator Session
          </button>
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="operator-shell">
      <div className="operator-rain" />
      <div className="operator-water" />

      <div
        className="operator-card"
        style={{
          width: 'min(560px, calc(100vw - 32px))',
          margin: '14vh auto 0',
          position: 'relative',
          zIndex: 5,
        }}
      >
        <div className="operator-label">Secure Operator Access</div>
        <div className="operator-value operator-cyan">DEVONN.AI</div>

        <p style={{ color: 'var(--operator-muted)', lineHeight: 1.7 }}>
          Enter the Operator API token for this browser session. The token is kept in
          session storage and cleared when the session ends.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14, marginTop: 22 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span className="operator-label">Operator Token</span>
            <input
              autoComplete="off"
              onChange={(event) => setToken(event.target.value)}
              placeholder="Bearer token"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 16,
                color: 'white',
                padding: '14px 16px',
              }}
              type="password"
              value={token}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span className="operator-label">Role</span>
            <select
              onChange={(event) => setRole(event.target.value)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 16,
                color: 'white',
                padding: '14px 16px',
              }}
              value={role}
            >
              <option value="operator">operator</option>
              <option value="admin">admin</option>
            </select>
          </label>

          <button className="operator-pill" type="submit">
            Start Secure Operator Session
          </button>
        </form>
      </div>
    </div>
  );
}

export default OperatorSessionGate;
