/** Gesture measurement inspired by Holo Gestures, MIT © 2026 Zubair Trabzada.
 * Original notice is retained in public/holo/LICENSE.txt. */
export type Point = { x: number; y: number; z?: number };
export type Hand = { id: number; cursor: Point; palm: Point; pinch: boolean; peace: boolean; open: boolean };
export type View = { x: number; y: number; scale: number; angle: number };
export const defaultView: View = { x: 0, y: 0, scale: 1, angle: 0 };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function measure(lm: Point[], mirror = true) {
  if (lm.length < 21 || lm.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const span = distance(lm[0], lm[9]);
  if (span < .015) return null;
  const tips = [8, 12, 16, 20].map(i => distance(lm[0], lm[i]) / span);
  const map = (p: Point) => ({ x: mirror ? 1 - p.x : p.x, y: p.y });
  return { palm: map({ x: (lm[0].x + lm[9].x) / 2, y: (lm[0].y + lm[9].y) / 2 }),
    cursor: map(lm[8]), ratio: distance(lm[4], lm[8]) / span,
    peace: tips[0] > 1.45 && tips[1] > 1.45 && tips[2] < 1.15 && tips[3] < 1.15,
    open: tips.every(t => t > 1.45) };
}
export class GestureEngine {
  private slots: { id: number; palm: Point; frames: number; pinch: boolean }[] = [];
  private nextId = 0;
  private hold: { command: string; since: number; fired: boolean } | null = null;
  update(landmarks: Point[][], now: number, mirror = true): { hands: Hand[]; command: 'reset' | 'arrange' | null } {
    const detections = landmarks.map(l => measure(l, mirror)).filter((m): m is NonNullable<typeof m> => m !== null);
    const used = new Set<number>();
    const hands: Hand[] = [];
    const next: typeof this.slots = [];
    for (const m of detections) {
      if (hands.some(h => distance(h.palm, m.palm) < .07)) continue;
      const nearest = this.slots.filter(s => !used.has(s.id) && distance(s.palm, m.palm) < .35)
        .sort((a, b) => distance(a.palm, m.palm) - distance(b.palm, m.palm))[0];
      const s = nearest ?? { id: this.nextId++, palm: m.palm, frames: 0, pinch: false };
      used.add(s.id);
      s.frames = m.ratio < .30 ? s.frames + 1 : 0;
      s.pinch = s.pinch ? m.ratio < .42 : s.frames >= 3;
      s.palm = m.palm;
      next.push(s);
      hands.push({ id: s.id, cursor: m.cursor, palm: m.palm, pinch: s.pinch, peace: m.peace, open: m.open });
    }
    this.slots = next;
    hands.sort((a, b) => a.id - b.id);
    const requested = hands.some(h => h.peace && !h.pinch) ? 'reset'
      : hands.length === 2 && hands.every(h => h.open && !h.pinch) ? 'arrange' : null;
    if (!requested) this.hold = null;
    else if (this.hold?.command !== requested) this.hold = { command: requested, since: now, fired: false };
    let command: 'reset' | 'arrange' | null = null;
    if (requested && this.hold && !this.hold.fired && now - this.hold.since >= 800) {
      command = requested; this.hold.fired = true;
    }
    return { hands, command };
  }
}
export function toWorld(p: Point, view: View): Point {
  const x = (p.x - view.x) / view.scale, y = (p.y - view.y) / view.scale;
  const c = Math.cos(-view.angle), s = Math.sin(-view.angle);
  return { x: x * c - y * s, y: x * s + y * c };
}
export function transformView(start: View, a: Point[], b: Point[]): View {
  const center = (p: Point[]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
  const ac = center(a), bc = center(b), anchor = toWorld(ac, start);
  const scale = Math.max(.5, Math.min(2, start.scale * distance(b[0], b[1]) / Math.max(1, distance(a[0], a[1]))));
  const angle = start.angle + Math.atan2(b[1].y - b[0].y, b[1].x - b[0].x) - Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x);
  const c = Math.cos(angle), s = Math.sin(angle);
  return { scale, angle, x: bc.x - scale * (anchor.x * c - anchor.y * s), y: bc.y - scale * (anchor.x * s + anchor.y * c) };
}
