export type OperatorSession = {
  token: string;
  role: 'admin' | 'operator' | string;
  createdAt: string;
};

const SESSION_KEY = 'devonn.operator.session';

export function loadOperatorSession(): OperatorSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OperatorSession;
    if (!parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveOperatorSession(token: string, role = 'operator'): OperatorSession {
  const session: OperatorSession = {
    token,
    role,
    createdAt: new Date().toISOString(),
  };

  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearOperatorSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function operatorAuthHeaders(): Record<string, string> {
  const session = loadOperatorSession();
  if (!session) return {};

  return {
    Authorization: `Bearer ${session.token}`,
    'X-Operator-Role': session.role,
  };
}

export function hasOperatorSession(): boolean {
  return loadOperatorSession() !== null;
}
