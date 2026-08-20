import { useMemo, useState } from 'react';
import { Activity, BarChart3, CheckCircle2, FlaskConical, Play, RefreshCw, ShieldCheck, SlidersHorizontal, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import {
  DEFAULT_BACKTEST_CONFIG,
  BacktestConfig,
  HistoricalBar,
  SignalBlock,
  combineEquityCurves,
  generateSyntheticData,
  runBacktest,
  runMonteCarlo,
  runWalkForward,
  summarizeRisk,
} from '@/lib/backtesting';

const ASSETS = ['SPY', 'QQQ', 'IWM', 'BTC'];
const signalLabels: Record<SignalBlock, string> = {
  sma_crossover: 'SMA crossover',
  rsi_threshold: 'RSI threshold',
  momentum: 'Momentum breakout',
};

const money = (value: number) => value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
const ratio = (value: number) => Number.isFinite(value) ? value.toFixed(2) : '∞';

export default function Backtesting() {
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_BACKTEST_CONFIG);
  const [assets, setAssets] = useState<string[]>(['SPY', 'QQQ']);
  const [bars, setBars] = useState<Record<string, HistoricalBar[]>>(() =>
    Object.fromEntries(ASSETS.map((asset, index) => [asset, generateSyntheticData(asset, 756, 42 + index * 17)])),
  );
  const [ranAt, setRanAt] = useState('');

  const results = useMemo(() => assets.map((asset) => ({ asset, result: runBacktest(bars[asset], config) })), [assets, bars, config]);
  const portfolioCurve = useMemo(() => combineEquityCurves(results.map((item) => item.result), config.initialCapital), [results, config.initialCapital]);
  const portfolioResult = useMemo(() => {
    if (!portfolioCurve.length) return null;
    const daily = portfolioCurve.slice(1).map((point) => point.dailyReturn);
    let peak = portfolioCurve[0].equity;
    let maxDrawdown = 0;
    portfolioCurve.forEach((point) => { peak = Math.max(peak, point.equity); maxDrawdown = Math.min(maxDrawdown, point.equity / peak - 1); });
    const avg = daily.length ? daily.reduce((a, b) => a + b, 0) / daily.length : 0;
    const vol = Math.sqrt(daily.reduce((sum, value) => sum + (value - avg) ** 2, 0) / Math.max(1, daily.length - 1)) * Math.sqrt(config.barsPerYear);
    const excess = avg - ((1 + config.riskFreeRate) ** (1 / config.barsPerYear) - 1);
    return { endingEquity: portfolioCurve[portfolioCurve.length - 1].equity, totalReturn: portfolioCurve[portfolioCurve.length - 1].equity / config.initialCapital - 1, volatility: vol, sharpe: vol ? excess * config.barsPerYear / vol : 0, maxDrawdown, trades: results.reduce((sum, item) => sum + item.result.trades.length, 0) };
  }, [portfolioCurve, config, results]);
  const walkForward = useMemo(() => results.length ? runWalkForward(bars[assets[0]], config, 4) : [], [results, bars, assets, config]);
  const monteCarlo = useMemo(() => results.length ? runMonteCarlo(results[0].result, 1000, 7) : null, [results]);
  const risk = useMemo(() => results.length ? summarizeRisk(results[0].result) : null, [results]);

  const toggleAsset = (asset: string) => setAssets((current) => current.includes(asset) ? current.filter((item) => item !== asset) : [...current, asset]);
  const update = <K extends keyof BacktestConfig>(key: K, value: BacktestConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));
  const rerun = () => {
    setBars(Object.fromEntries(ASSETS.map((asset, index) => [asset, generateSyntheticData(asset, 756, 42 + index * 17)])));
    setRanAt(new Date().toLocaleTimeString());
  };

  return (
    <div className="min-h-screen bg-background">
      <D3vonnPageBanner title="D3VONN.IO • Backtesting" subtitle="SIMULATE. VALIDATE. MEASURE RISK." />
      <main className="container mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">ENGINE READY</Badge><Badge variant="outline">BIAS-AWARE</Badge><Badge variant="outline">RISK-FIRST</Badge></div>
            <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Strategy Backtesting Lab</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">Build reusable signal rules, replay deterministic historical bars, model execution friction, and validate a strategy before it reaches live capital.</p>
          </div>
          <Button onClick={rerun}><RefreshCw /> Regenerate dataset {ranAt && `· ${ranAt}`}</Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> Strategy</CardTitle><CardDescription>Reusable signal blocks and execution assumptions.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Signal block"><select value={config.signal} onChange={(e) => update('signal', e.target.value as SignalBlock)} className="control">{Object.entries(signalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                <Field label="Initial capital"><input className="control" type="number" min="1000" step="1000" value={config.initialCapital} onChange={(e) => update('initialCapital', Number(e.target.value))} /></Field>
                <div className="grid grid-cols-2 gap-3"><Field label="Fast SMA"><input className="control" type="number" min="2" value={config.fastPeriod} onChange={(e) => update('fastPeriod', Number(e.target.value))} /></Field><Field label="Slow SMA"><input className="control" type="number" min="3" value={config.slowPeriod} onChange={(e) => update('slowPeriod', Number(e.target.value))} /></Field></div>
                <div className="grid grid-cols-2 gap-3"><Field label="Commission bps"><input className="control" type="number" min="0" step="1" value={config.commissionBps} onChange={(e) => update('commissionBps', Number(e.target.value))} /></Field><Field label="Slippage bps"><input className="control" type="number" min="0" step="1" value={config.slippageBps} onChange={(e) => update('slippageBps', Number(e.target.value))} /></Field></div>
                <div className="grid grid-cols-2 gap-3"><Field label="RSI period"><input className="control" type="number" min="2" value={config.rsiPeriod} onChange={(e) => update('rsiPeriod', Number(e.target.value))} /></Field><Field label="Momentum %"><input className="control" type="number" min="0" step="0.5" value={config.momentumEntry} onChange={(e) => update('momentumEntry', Number(e.target.value))} /></Field></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Universe</CardTitle><CardDescription>Select multiple assets for equal-weight replay.</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">{ASSETS.map((asset) => <button key={asset} onClick={() => toggleAsset(asset)} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${assets.includes(asset) ? 'border-primary bg-primary/10 text-primary' : 'border-border/40 text-muted-foreground'}`}>{asset}</button>)}</CardContent>
            </Card>
          </aside>

          <section className="space-y-6">
            {portfolioResult && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Ending equity" value={money(portfolioResult.endingEquity)} icon={<Activity />} />
              <Metric label="Total return" value={pct(portfolioResult.totalReturn)} icon={portfolioResult.totalReturn >= 0 ? <TrendingUp /> : <TrendingDown />} />
              <Metric label="Sharpe" value={ratio(portfolioResult.sharpe)} icon={<BarChart3 />} />
              <Metric label="Max drawdown" value={pct(portfolioResult.maxDrawdown)} icon={<TrendingDown />} />
              <Metric label="Trades" value={String(portfolioResult.trades)} icon={<Play />} />
            </div>}

            <Card>
              <CardHeader><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Equity replay</CardTitle><CardDescription>Equal-weight portfolio curve across {assets.join(', ') || 'no assets'}.</CardDescription></div><Badge variant="secondary">756 deterministic bars / asset</Badge></div></CardHeader>
              <CardContent><EquityChart points={portfolioCurve} /></CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card><CardHeader><CardTitle>Risk & performance</CardTitle><CardDescription>Per-asset results with execution friction included.</CardDescription></CardHeader><CardContent className="space-y-3">{results.map(({ asset, result }) => <div key={asset} className="rounded-xl border border-border/30 bg-surface-2 p-4"><div className="flex items-center justify-between"><span className="font-bold">{asset}</span><span className={result.metrics.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>{pct(result.metrics.totalReturn)}</span></div><div className="mt-3 grid grid-cols-4 gap-2 text-xs"><Stat label="Sharpe" value={ratio(result.metrics.sharpe)} /><Stat label="Sortino" value={ratio(result.metrics.sortino)} /><Stat label="Drawdown" value={pct(result.metrics.maxDrawdown)} /><Stat label="Win rate" value={pct(result.metrics.winRate)} /></div></div>)}</CardContent></Card>
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5" /> Validation</CardTitle><CardDescription>Out-of-sample folds plus bootstrap trade-path analysis.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-4 gap-2">{walkForward.map((fold) => <div key={fold.index} className="rounded-lg border border-border/30 p-3 text-center"><p className="text-xs text-muted-foreground">Fold {fold.index}</p><p className="mt-1 font-bold">{pct(fold.returnPct)}</p><p className="text-xs text-muted-foreground">DD {pct(fold.maxDrawdown)}</p></div>)}</div>{monteCarlo && <div className="rounded-xl border border-border/30 bg-surface-2 p-4"><p className="text-sm font-semibold">Monte Carlo · {monteCarlo.iterations.toLocaleString()} paths</p><div className="mt-3 grid grid-cols-4 gap-3"><Stat label="P05" value={pct(monteCarlo.p05)} /><Stat label="Median" value={pct(monteCarlo.p50)} /><Stat label="P95" value={pct(monteCarlo.p95)} /><Stat label="Loss odds" value={pct(monteCarlo.probabilityOfLoss)} /></div></div>}</CardContent></Card>
            </div>

            <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Research integrity gate</CardTitle><CardDescription>Controls that should remain mandatory before connecting a live market-data provider or execution account.</CardDescription></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2">{risk?.integrityChecks.map((check) => <div key={check} className="flex gap-3 rounded-xl border border-border/30 p-4 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{check}</div>)}</div><div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">This release intentionally uses deterministic synthetic bars so the UI and mathematics can be verified without implying access to licensed market history. Production promotion should require a data-provider contract, corporate-action handling, survivorship-bias controls, timestamp normalization, audit logging, and an independently verified execution model.</div></CardContent></Card>
          </section>
        </div>
      </main>
      <style>{`.control{width:100%;height:40px;border-radius:8px;border:1px solid hsl(var(--border)/.45);background:hsl(var(--muted)/.15);padding:0 10px;color:hsl(var(--foreground));font-size:14px}.control:focus{outline:none;border-color:hsl(var(--primary)/.6);box-shadow:0 0 0 2px hsl(var(--primary)/.12)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>; }
function Stat({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <Card className="p-4"><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span><span className="text-primary">{icon}</span></div><p className="mt-2 text-2xl font-black">{value}</p></Card>; }
function EquityChart({ points }: { points: { date: string; equity: number }[] }) {
  if (!points.length) return <div className="flex h-64 items-center justify-center text-muted-foreground">Select at least one asset.</div>;
  const min = Math.min(...points.map((p) => p.equity)); const max = Math.max(...points.map((p) => p.equity)); const range = Math.max(1, max - min);
  const width = 900; const height = 280; const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${(index / (points.length - 1)) * width} ${height - ((point.equity - min) / range) * (height - 24)}`).join(' ');
  return <div className="overflow-hidden rounded-xl border border-border/30 bg-surface-2 p-3"><svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Portfolio equity curve"><path d={path} fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" vectorEffect="non-scaling-stroke" /><line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="currentColor" className="text-border/30" /><text x="8" y="18" className="fill-muted-foreground text-[12px]">{money(max)}</text><text x="8" y={height - 8} className="fill-muted-foreground text-[12px]">{money(min)}</text></svg></div>;
}
