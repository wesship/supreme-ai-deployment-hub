import { describe, expect, it } from 'vitest';
import { GestureEngine, measure, toWorld, transformView, defaultView, type Point } from './gestureEngine';
const hand = (x = .5, ratio = .2, mode = 'pinch'): Point[] => {
  const p = Array.from({ length: 21 }, () => ({ x, y: .5 }));
  p[9] = { x, y: .3 }; p[8] = { x, y: .15 }; p[4] = { x: x + ratio * .2, y: .15 };
  for (const i of [12, 16, 20]) p[i] = { x, y: mode === 'open' || (mode === 'peace' && i === 12) ? .15 : .4 };
  return p;
};
describe('gesture geometry and commands', () => {
  it('rejects nonfinite landmarks', () => { const p = hand(); p[4].x = NaN; expect(measure(p)).toBeNull(); });
  it('rejects degenerate hands', () => expect(measure(Array.from({ length: 21 }, () => ({ x: 0, y: 0 })))).toBeNull());
  it('maps forward and mirrored cameras', () => { expect(measure(hand(.2))?.cursor.x).toBeCloseTo(.8); expect(measure(hand(.2), false)?.cursor.x).toBeCloseTo(.2); });
  it('requires three frames to pinch', () => { const e = new GestureEngine(); expect(e.update([hand()], 0).hands[0].pinch).toBe(false); expect(e.update([hand()], 34).hands[0].pinch).toBe(false); expect(e.update([hand()], 68).hands[0].pinch).toBe(true); });
  it('keeps a pinch through hysteresis and releases above threshold', () => { const e = new GestureEngine(); for (let i = 0; i < 3; i++) e.update([hand()], i); expect(e.update([hand(.5, .35)], 4).hands[0].pinch).toBe(true); expect(e.update([hand(.5, .5)], 5).hands[0].pinch).toBe(false); });
  it('deduplicates ghost hands', () => expect(new GestureEngine().update([hand(.5), hand(.51)], 0).hands).toHaveLength(1));
  it('preserves identities when detector ordering swaps', () => { const e = new GestureEngine(); const a = e.update([hand(.2), hand(.8)], 0).hands; const b = e.update([hand(.8), hand(.2)], 1).hands; expect(b.map(h => h.id)).toEqual(a.map(h => h.id)); expect(b[0].palm.x).toBeCloseTo(a[0].palm.x); });
  it('fires held peace once until release', () => { const e = new GestureEngine(); expect(e.update([hand(.5, .7, 'peace')], 0).command).toBeNull(); expect(e.update([hand(.5, .7, 'peace')], 800).command).toBe('reset'); expect(e.update([hand(.5, .7, 'peace')], 1800).command).toBeNull(); e.update([], 2000); e.update([hand(.5, .7, 'peace')], 2100); expect(e.update([hand(.5, .7, 'peace')], 2900).command).toBe('reset'); });
  it('fires held two-palm arrangement', () => { const e = new GestureEngine(); e.update([hand(.2, .7, 'open'), hand(.8, .7, 'open')], 0); expect(e.update([hand(.2, .7, 'open'), hand(.8, .7, 'open')], 800).command).toBe('arrange'); });
  it('anchors rotation and clamps scale', () => { const v = transformView(defaultView, [{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 20, y: 0 }, { x: 20, y: 100 }]); expect(v.scale).toBe(2); expect(v.angle).toBeCloseTo(Math.PI / 2); const p = toWorld({ x: 20, y: 50 }, v); expect(p.x).toBeCloseTo(5); expect(p.y).toBeCloseTo(0); });
});
