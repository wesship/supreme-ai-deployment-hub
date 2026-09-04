import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDoorCapabilities, type DoorCapabilities } from '@/features/the-door/theDoorApi';

export default function TheDoor() {
  const [capabilities, setCapabilities] = useState<DoorCapabilities | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setCapabilities(await getDoorCapabilities());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load THE DOOR capabilities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">D3VONN.IO Game Development</p>
          <h1 className="mt-2 text-4xl font-semibold text-white">THE DOOR</h1>
          <p className="mt-3 max-w-3xl text-sm text-white/60">
            Provider-neutral game-development control plane for world building, gameplay systems,
            playtesting, repair, verification, and shared cinematic/game assets.
          </p>
        </div>
        <Button onClick={() => void refresh()} disabled={loading}>{loading ? 'Checking…' : 'Refresh runtime'}</Button>
      </div>

      {error && <Card className="mb-6 border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">{error}</Card>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-white/40">Control plane</p>
          <p className="mt-2 text-lg font-semibold text-white">Multi-engine</p>
          <p className="mt-2 text-sm text-white/55">Hermes stays above vendor-specific engine transports.</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-white/40">Verification loop</p>
          <p className="mt-2 text-lg font-semibold text-white">Build → Verify</p>
          <p className="mt-2 text-sm text-white/55">Build, playtest, observe, diagnose, repair, verify.</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-white/40">Shared assets</p>
          <p className="mt-2 text-lg font-semibold text-white">Blender pipeline</p>
          <p className="mt-2 text-sm text-white/55">One canonical asset can serve AI Films and playable builds.</p>
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Engine adapters</h2>
          <span className="text-xs text-white/40">Only configured transports may execute</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(capabilities?.engine_adapters ?? []).map((adapter) => (
            <Card key={adapter.provider} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{adapter.provider}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-white/40">{adapter.engine}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${adapter.configured ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'}`}>
                  {adapter.configured ? 'Configured' : 'Boundary only'}
                </span>
              </div>
              {adapter.role && <p className="mt-4 text-sm text-white/60">{adapter.role}</p>}
              {adapter.recommended_for?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {adapter.recommended_for.map((item) => <span key={item} className="rounded-md bg-white/5 px-2 py-1 text-xs text-white/50">{item}</span>)}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold text-white">Shared creative pipeline</h2>
        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-white">Blender</p>
              <p className="mt-2 text-sm text-white/60">Asset preparation, rigs, animation, LODs, collision, texture baking, Geometry Nodes, glTF and USD export.</p>
            </div>
            <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-200">
              {capabilities?.asset_pipeline.configured ? 'Configured' : 'Transport pending'}
            </span>
          </div>
          {capabilities?.asset_pipeline.recommended_version && (
            <p className="mt-4 text-xs text-white/40">Recommended production line: Blender {capabilities.asset_pipeline.recommended_version}</p>
          )}
        </Card>
      </section>
    </div>
  );
}
