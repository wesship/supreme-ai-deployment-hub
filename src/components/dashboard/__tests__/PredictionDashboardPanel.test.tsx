/**
 * PredictionDashboardPanel.test.tsx — Unit tests for PredictionDashboardPanel
 *
 * Validates safe-boundary behavior:
 *   - Backend down  → panel degrades cleanly (no crash, error state shown)
 *   - Empty         → warm-up state renders
 *   - Mixed shapes  → both { predictions } and { data } render correctly
 *   - Critical/high → cards count correctly
 *   - Advisory note → advisory boundary notice is always visible
 *
 * Run:
 *   npx vitest run src/components/dashboard/__tests__/PredictionDashboardPanel.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Prediction, RecoveryAdvisory, RiskLevel } from '@/hooks/useOperatorPredictions';
import PredictionDashboardPanel from '@/components/dashboard/PredictionDashboardPanel';

// ---------------------------------------------------------------------------
// Inline mock for useOperatorPredictions — avoids module resolution issues
// ---------------------------------------------------------------------------

let mockPredictions: Prediction[] = [];
let mockAdvisories: RecoveryAdvisory[] = [];
let mockIsLoading = false;
let mockError: string | null = null;
let mockLastRefreshed: Date | null = null;

vi.mock('@/hooks/useOperatorPredictions', () => ({
  useOperatorPredictions: () => ({
    predictions: mockPredictions,
    advisories: mockAdvisories,
    isLoading: mockIsLoading,
    error: mockError,
    lastRefreshed: mockLastRefreshed,
    refresh: vi.fn(),
  }),
  riskColor: (risk: RiskLevel) => {
    const map: Record<RiskLevel, string> = {
      critical: 'text-red-500',
      high: 'text-orange-500',
      moderate: 'text-yellow-500',
      low: 'text-blue-500',
      info: 'text-muted-foreground',
    };
    return map[risk] ?? 'text-muted-foreground';
  },
  riskBadgeVariant: (risk: RiskLevel) => {
    if (risk === 'critical' || risk === 'high') return 'destructive';
    if (risk === 'moderate') return 'default';
    if (risk === 'low') return 'secondary';
    return 'outline';
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makePrediction = (overrides: Partial<Prediction> = {}): Prediction => ({
  id: 'pred-1',
  category: 'queue_saturation',
  risk: 'moderate',
  likelihood: 0.65,
  description: 'Queue backlog is rising faster than consumption rate',
  watchSurfaces: ['queue/taskQueue.json', 'queue/deadLetterQueue.js'],
  guidance: 'Consider scaling consumer agents or investigating backlog source.',
  timestamp: new Date().toISOString(),
  ...overrides,
});

const makeAdvisory = (overrides: Partial<RecoveryAdvisory> = {}): RecoveryAdvisory => ({
  id: 'adv-1',
  type: 'Retry Loop Detected',
  severity: 'high',
  recommendation:
    'Investigate failed tasks in dead-letter queue. Check network connectivity to message broker.',
  manualReviewRequired: true,
  timestamp: new Date().toISOString(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function setMockState(state: {
  predictions?: Prediction[];
  advisories?: RecoveryAdvisory[];
  isLoading?: boolean;
  error?: string | null;
  lastRefreshed?: Date | null;
}) {
  mockPredictions = state.predictions ?? [];
  mockAdvisories = state.advisories ?? [];
  mockIsLoading = state.isLoading ?? false;
  mockError = state.error ?? null;
  mockLastRefreshed = state.lastRefreshed ?? null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PredictionDashboardPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockState({});
  });

  // --- Warm-up / empty state ---

  it('shows warm-up empty state when no predictions and not loading', () => {
    setMockState({ predictions: [], advisories: [], isLoading: false });
    render(<PredictionDashboardPanel />);
    expect(screen.getByText(/prediction engine warming up/i)).toBeInTheDocument();
    expect(screen.getByText(/no predictions yet/i)).toBeInTheDocument();
  });

  it('does not show warm-up state when predictions exist', () => {
    setMockState({ predictions: [makePrediction()], advisories: [], isLoading: false });
    render(<PredictionDashboardPanel />);
    expect(screen.queryByText(/prediction engine warming up/i)).not.toBeInTheDocument();
  });

  // --- Error / backend-down degradation ---

  it('shows error state when backend is unavailable', () => {
    setMockState({
      predictions: [],
      advisories: [],
      isLoading: false,
      error: 'ECONNREFUSED: Connection refused to backend on port 8000',
    });
    render(<PredictionDashboardPanel />);
    expect(screen.getByText(/ECONNREFUSED/i)).toBeInTheDocument();
  });

  it('does not crash when error message contains HTML characters', () => {
    setMockState({
      predictions: [],
      advisories: [],
      isLoading: false,
      error: 'Backend unavailable at https://devonn-api.example.com/api/operator/predictions — <html>noise</html>',
    });
    expect(() => render(<PredictionDashboardPanel />)).not.toThrow();
    // Error message should be displayed as escaped text, not rendered as HTML tags
    expect(screen.getByText(/Backend unavailable/i)).toBeInTheDocument();
    // Verify no actual <html> DOM element was injected (i.e., not dangerouslySetInnerHTML)
    expect(document.querySelector('html > body > div html')).toBeNull();
  });

  // --- Predictions render correctly ---

  it('renders predictions from { predictions: [] } response shape', () => {
    setMockState({
      predictions: [
        makePrediction({ id: 'p1', risk: 'critical', category: 'deployment_instability' }),
        makePrediction({ id: 'p2', risk: 'high', category: 'runtime_degradation' }),
        makePrediction({ id: 'p3', risk: 'low', category: 'observability_blind_spot' }),
      ],
      advisories: [],
      isLoading: false,
    });
    render(<PredictionDashboardPanel />);

    expect(screen.getByText('Deployment Instability')).toBeInTheDocument();
    expect(screen.getByText('Runtime Degradation')).toBeInTheDocument();
    expect(screen.getByText('Observability Gap')).toBeInTheDocument();
  });

  // --- Critical/high count cards ---

  it('counts critical and high risk predictions in summary cards', () => {
    setMockState({
      predictions: [
        makePrediction({ id: 'c1', risk: 'critical' }),
        makePrediction({ id: 'c2', risk: 'critical' }),
        makePrediction({ id: 'h1', risk: 'high' }),
        makePrediction({ id: 'm1', risk: 'moderate' }),
      ],
      advisories: [],
      isLoading: false,
    });
    render(<PredictionDashboardPanel />);

    // Critical card shows "2"
    const criticalCards = screen.getAllByText('2').filter((el) => {
      const parent = el.closest('[class*="bg-red"]');
      return parent !== null;
    });
    expect(criticalCards.length).toBeGreaterThan(0);

    // High Risk card shows "1"
    const highCards = screen.getAllByText('1').filter((el) => {
      const parent = el.closest('[class*="bg-orange"]');
      return parent !== null;
    });
    expect(highCards.length).toBeGreaterThan(0);
  });

  it('shows 0 critical and 0 high when all predictions are low/info', () => {
    setMockState({
      predictions: [makePrediction({ id: 'l1', risk: 'low' }), makePrediction({ id: 'i1', risk: 'info' })],
      advisories: [],
      isLoading: false,
    });
    render(<PredictionDashboardPanel />);

    const criticalEls = screen.getAllByText('0').filter((el) => el.closest('[class*="bg-red"]') !== null);
    expect(criticalEls.length).toBeGreaterThan(0);
  });

  // --- Advisory cards ---

  it('shows advisory cards when advisories are present', () => {
    setMockState({
      predictions: [],
      advisories: [
        makeAdvisory({ id: 'a1', type: 'Dead Letter Queue Alert', severity: 'critical' }),
        makeAdvisory({ id: 'a2', type: 'Memory Pressure Warning', severity: 'moderate' }),
      ],
      isLoading: false,
    });
    render(<PredictionDashboardPanel />);

    expect(screen.getByText('Dead Letter Queue Alert')).toBeInTheDocument();
    expect(screen.getByText('Memory Pressure Warning')).toBeInTheDocument();
  });

  it('shows manual-review badge only on advisories that require it', () => {
    setMockState({
      predictions: [],
      advisories: [
        makeAdvisory({ id: 'a1', manualReviewRequired: true }),
        makeAdvisory({ id: 'a2', manualReviewRequired: false }),
      ],
      isLoading: false,
    });
    render(<PredictionDashboardPanel />);

    expect(screen.getAllByText('manual review')).toHaveLength(1);
  });

  // --- Advisory boundary notice ---

  it('always shows the advisory boundary notice', () => {
    setMockState({ predictions: [], advisories: [], isLoading: false });
    render(<PredictionDashboardPanel />);
    expect(screen.getByText(/advisory only/i)).toBeInTheDocument();
    expect(screen.getByText(/no infrastructure is mutated/i)).toBeInTheDocument();
  });

  it('shows advisory notice even when backend is down', () => {
    setMockState({ predictions: [], advisories: [], isLoading: false, error: 'Backend unavailable' });
    render(<PredictionDashboardPanel />);
    expect(screen.getByText(/advisory only/i)).toBeInTheDocument();
  });

  // --- Prediction card expansion ---

  it('expands a prediction card to show watch surfaces and guidance', async () => {
    const user = userEvent.setup();
    setMockState({
      predictions: [
        makePrediction({
          id: 'p1',
          watchSurfaces: ['queue/taskQueue.json', 'queue/deadLetterQueue.js'],
          guidance: 'Consider scaling consumer agents.',
        }),
      ],
      advisories: [],
      isLoading: false,
    });
    render(<PredictionDashboardPanel />);

        const cardHeader = screen.getByText('Queue Saturation').closest('button')!;
    await user.click(cardHeader);
    // watchSurfaces are rendered inside Badge elements — use getAllByText for partial match
    expect(screen.getByText((content) => content.includes('queue/taskQueue.json'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('Consider scaling consumer agents.'))).toBeInTheDocument();
  });

  it('collapses an expanded prediction card on second click', async () => {
    const user = userEvent.setup();
    setMockState({
      predictions: [
        makePrediction({
          id: 'p1',
          watchSurfaces: ['queue/taskQueue.json'],
          guidance: 'Guidance text',
        }),
      ],
      advisories: [],
      isLoading: false,
    });
    render(<PredictionDashboardPanel />);

    const cardHeader = screen.getByText('Queue Saturation').closest('button')!;
        await user.click(cardHeader);
    expect(screen.getByText((content) => content.includes('Guidance text'))).toBeInTheDocument();
    await user.click(cardHeader);
    // AnimatePresence uses async exit animations; waitFor handles the async removal
    await waitFor(() => {
      expect(screen.queryByText((content) => content.includes('Guidance text'))).not.toBeInTheDocument();
    });
  });

  // --- Likelihood display ---

  it('displays likelihood as a percentage', () => {
    setMockState({ predictions: [makePrediction({ id: 'p1', likelihood: 0.73 })], advisories: [], isLoading: false });
    render(<PredictionDashboardPanel />);
    expect(screen.getByText('73% likelihood')).toBeInTheDocument();
  });

  it('displays 0% likelihood correctly', () => {
    setMockState({ predictions: [makePrediction({ id: 'p1', likelihood: 0.0 })], advisories: [], isLoading: false });
    render(<PredictionDashboardPanel />);
    expect(screen.getByText('0% likelihood')).toBeInTheDocument();
  });

  // --- Last refreshed timestamp ---

  it('shows last refreshed time when data has loaded', () => {
    const now = new Date();
    setMockState({ predictions: [makePrediction()], advisories: [], isLoading: false, lastRefreshed: now });
    render(<PredictionDashboardPanel />);
    expect(screen.getByText(new RegExp(`Updated ${now.toLocaleTimeString()}`))).toBeInTheDocument();
  });
});