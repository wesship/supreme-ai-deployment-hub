import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConversationalVoiceControls } from '@/components/ai/ConversationalVoiceControls';
import { defaultView, toWorld, transformView, type Hand, type Point, type View } from '@/features/holo/gestureEngine';
import { useHandTracking } from '@/features/holo/useHandTracking';
import { useDisplayConnection } from '@/features/holo/useDisplayConnection';
import '@/styles/holo-workspace.css';

type Card = { id: string; title: string; detail: string; route?: string; x: number; y: number };
const routes = [
  ['hermes', 'Hermes', 'Plan and run workflows', '/workflows'],
  ['knowledge', 'Knowledge graph', 'Explore connected intelligence', '/knowledge-graph'],
  ['agents', 'Agents', 'Your specialist workforce', '/agents'],
  ['films', 'Film Studio', 'Create with your production tools', '/ai-films/studio'],
  ['voice', 'Voice Studio', 'Converse and create', '/voice-studio'],
  ['control', 'Mission control', 'Monitor platform operations', '/command-center'],
];
const grid = (cards: Card[]) => cards.map((c, i) => ({ ...c, x: 30 + (i % 3) * 250, y: 30 + Math.floor(i / 3) * 160 }));
const initial = () => grid(routes.map(([id, title, detail, route]) => ({ id, title, detail, route, x: 0, y: 0 })));
export default function HoloWorkspace() {
  const [cards, setCards] = useState<Card[]>(initial), cardsRef = useRef(cards); cardsRef.current = cards;
  const [view, setView] = useState<View>(defaultView), viewRef = useRef(view); viewRef.current = view;
  const [selected, setSelected] = useState('hermes');
  const [display, setDisplay] = useState(() => new URLSearchParams(location.search).get('display') === 'xreal' ? 'xreal' : 'monitor');
  const [camera, setCamera] = useState(''), [mirror, setMirror] = useState(true), [preview, setPreview] = useState(false);
  const [message, setMessage] = useState(''), [hands, setHands] = useState<Hand[]>([]);
  const importing = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; window.speechSynthesis?.cancel(); }; }, []);
  const [session] = useState(() => crypto.randomUUID());
  const stageRef = useRef<HTMLDivElement>(null), fileRef = useRef<HTMLInputElement>(null), alive = useRef(true);
  const drag = useRef<{ id: string; hand: number; offset: Point; start: Point; since: number; moved: boolean } | null>(null);
  const dual = useRef<{ ids: string; points: Point[]; view: View } | null>(null);
  const pointer = useRef<{ id: string; start: Point; offset: Point; moved: boolean } | null>(null);
  const displayConnection = useDisplayConnection();
  const arrange = () => { setCards(c => grid(c)); setView(defaultView); drag.current = null; dual.current = null; };
  const reset = () => { setView(defaultView); drag.current = null; dual.current = null; };
  const tracking = useHandTracking((next, command) => {
    setHands(next);
    if (command === 'reset') { reset(); return; }
    if (command === 'arrange') { arrange(); return; }
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const screen = (h: Hand) => ({ x: h.cursor.x * bounds.width, y: h.cursor.y * bounds.height });
    const pinching = next.filter(h => h.pinch);
    if (pinching.length === 2) {
      drag.current = null;
      const points = pinching.map(screen), ids = pinching.map(h => h.id).join(',');
      if (dual.current?.ids !== ids) dual.current = { ids, points, view: viewRef.current };
      else setView(transformView(dual.current.view, dual.current.points, points));
      return;
    }
    if (dual.current) { dual.current = null; drag.current = null; return; }
    const grabbed = drag.current;
    if (grabbed) {
      const hand = next.find(h => h.id === grabbed.hand);
      if (!hand?.pinch) {
        if (hand && !grabbed.moved && performance.now() - grabbed.since < 500) setSelected(grabbed.id);
        drag.current = null; return;
      }
      const position = screen(hand), world = toWorld(position, viewRef.current);
      if (Math.hypot(position.x - grabbed.start.x, position.y - grabbed.start.y) > 10) grabbed.moved = true;
      setCards(c => c.map(card => card.id === grabbed.id ? { ...card, x: world.x - grabbed.offset.x, y: world.y - grabbed.offset.y } : card));
    } else if (pinching.length === 1) {
      const hand = pinching[0], p = screen(hand), world = toWorld(p, viewRef.current);
      const card = [...cardsRef.current].reverse().find(c => world.x >= c.x && world.x <= c.x + 220 && world.y >= c.y && world.y <= c.y + 130);
      if (card) drag.current = { id: card.id, hand: hand.id, start: p, offset: { x: world.x - card.x, y: world.y - card.y }, since: performance.now(), moved: false };
    }
  });
  const current = cards.find(c => c.id === selected);
  const pointerPosition = (x: number, y: number) => {
    const b = stageRef.current!.getBoundingClientRect(); return { x: x - b.left, y: y - b.top };
  };
  async function importNotes(files: FileList | null) {
    if (!files || importing.current) return;
    importing.current = true;
    try {
    const notes = cardsRef.current.filter(c => !c.route).length;
    if (files.length + notes > 20) { setMessage('Keep at most 20 local notes.'); return; }
    const added: Card[] = [];
    for (const file of Array.from(files)) {
      if (!/\.(txt|md)$/i.test(file.name) || file.size > 65536) { setMessage('Choose .txt or .md files up to 64 KB each.'); return; }
      const text = await file.text();
      added.push({ id: crypto.randomUUID(), title: file.name, detail: text, x: 40 + added.length * 30, y: 380 });
    }
    if (alive.current) { setCards(c => [...c, ...added]); setMessage('Notes stay in memory on this device. Leaving this page clears them.'); }
    } catch { if (alive.current) setMessage('This file could not be read.'); } finally { importing.current = false; }
  }
  function readNote() {
    if (!current || current.route) return;
    if (!window.speechSynthesis) { setMessage('Local read-aloud is unavailable.'); return; }
    const voice = speechSynthesis.getVoices().find(v => v.localService && v.lang.startsWith('en'));
    if (!voice) { setMessage('No local English voice is installed.'); return; }
    speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(current.detail); utterance.voice = voice; speechSynthesis.speak(utterance);
  }
  return <div data-voice-skip ref={displayConnection.rootRef} className={`holo-workspace ${display === 'xreal' ? 'holo-glasses' : ''}`}>
    <header className="holo-header"><Link reloadDocument to="/">D3VONN.IO</Link><span>HAND WORKSPACE</span><Link reloadDocument to="/knowledge-graph">Exit to knowledge graph</Link></header>
    <div className="holo-intro"><p className="holo-eyebrow">ONE PLATFORM · ONE INTELLIGENCE</p><h1>Your intelligence, within reach.</h1><p>Move your workspace with your hands. Connect your display, then bring Hermes into the conversation.</p></div>
    <div className="holo-controls" aria-label="Workspace controls">
      <label>Display <select value={display} onChange={e => setDisplay(e.target.value)}><option value="monitor">Monitor</option><option value="xreal">XREAL / display glasses</option></select></label>
      <button onClick={displayConnection.toggleFullscreen}>{displayConnection.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</button>
      <button onClick={displayConnection.findCameras}>Find cameras</button>
      <label>Camera <select value={camera} onChange={e => { tracking.stop(); setCamera(e.target.value); }}><option value="">Default webcam</option>{displayConnection.cameras.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}</select></label>
      <label><input type="checkbox" checked={mirror} onChange={e => { tracking.stop(); setMirror(e.target.checked); }} />Mirror camera</label>
      <label><input type="checkbox" checked={preview} onChange={e => setPreview(e.target.checked)} />Show camera preview</label>
      <button className="holo-primary" onClick={() => tracking.active || tracking.loading ? tracking.stop() : tracking.start(camera || undefined, mirror)}>{tracking.active || tracking.loading ? 'Stop camera' : 'Start hand tracking'}</button>
    </div>
    <p role="status" className="holo-status">{tracking.status}{displayConnection.error ? ` · ${displayConnection.error}` : ''}</p>
    <details className="holo-connect"><summary>Connect glasses or a monitor</summary><p>Connect XREAL display glasses to a host with USB-C DisplayPort video output, or connect a monitor using its supported cable. In your operating system, extend or mirror the display, move this browser window to it, select the glasses layout and enter fullscreen. Choose audio input and output in your system settings. Hand tracking uses the selected webcam; native glasses sensors and 6DoF are not connected through this browser.</p></details>
    <nav className="holo-mobile-tools" aria-label="All workspace cards">{cards.map(card => <button key={card.id} aria-pressed={selected === card.id} onClick={() => setSelected(card.id)}>{card.title}</button>)}</nav>
    <div className="holo-layout"><section className="holo-main" aria-label="Hand workspace">
      <div className="holo-toolbar"><button onClick={reset}>Reset view</button><button onClick={arrange}>Arrange cards</button><button aria-label="Zoom out" onClick={() => setView(v => ({ ...v, scale: Math.max(.5, v.scale - .1) }))}>−</button><span>{Math.round(view.scale * 100)}%</span><button aria-label="Zoom in" onClick={() => setView(v => ({ ...v, scale: Math.min(2, v.scale + .1) }))}>+</button><button onClick={() => fileRef.current?.click()}>Import local note</button><input ref={fileRef} aria-label="Import local notes" type="file" accept=".txt,.md" multiple hidden onChange={e => { void importNotes(e.target.files); e.target.value = ''; }} /></div>
      <div className="holo-stage" ref={stageRef} onPointerMove={e => {
        const grabbed = pointer.current; if (!grabbed) return;
        const p = pointerPosition(e.clientX, e.clientY), w = toWorld(p, viewRef.current);
        if (Math.hypot(p.x - grabbed.start.x, p.y - grabbed.start.y) > 8) grabbed.moved = true;
        setCards(c => c.map(card => card.id === grabbed.id ? { ...card, x: w.x - grabbed.offset.x, y: w.y - grabbed.offset.y } : card));
      }} onPointerUp={e => { if (pointer.current && !pointer.current.moved) setSelected(pointer.current.id); pointer.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }} onPointerCancel={() => { pointer.current = null; }}>
        <div className="holo-world" style={{ transform: `translate(${view.x}px, ${view.y}px) rotate(${view.angle}rad) scale(${view.scale})` }}>
          {cards.map(card => <button key={card.id} className={`holo-card ${selected === card.id ? 'is-selected' : ''}`} style={{ left: card.x, top: card.y }} aria-pressed={selected === card.id} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(card.id); } }} onPointerDown={e => {
            if (e.button !== 0) return; e.preventDefault(); const p = pointerPosition(e.clientX, e.clientY), w = toWorld(p, viewRef.current);
            pointer.current = { id: card.id, start: p, offset: { x: w.x - card.x, y: w.y - card.y }, moved: false }; stageRef.current?.setPointerCapture(e.pointerId);
          }}><small>{card.route ? 'PLATFORM' : 'LOCAL NOTE'}</small><strong>{card.title}</strong><span>{card.route ? card.detail : card.detail.slice(0, 70)}</span></button>)}
        </div>
        {hands.map(h => <span key={h.id} className={`holo-cursor ${h.pinch ? 'is-pinching' : ''}`} style={{ left: `${h.cursor.x * 100}%`, top: `${h.cursor.y * 100}%` }} />)}
      </div>
      <p className="holo-help">Pinch to drag · Quick pinch to select · Two pinches to zoom, pan and rotate · Hold peace to reset · Hold two open palms to arrange. Pointer, touch and keyboard work too.</p>
    </section><aside className="holo-detail" aria-label="Selected card"><p className="holo-eyebrow">SELECTED</p><h2>{current?.title ?? 'Select a card'}</h2>{current && <p className="holo-note">{current.detail}</p>}{current?.route ? <Link className="holo-open" reloadDocument to={current.route}>Open {current.title} →</Link> : current ? <div className="holo-controls"><button onClick={readNote}>Read aloud locally</button><button onClick={() => { setCards(c => c.filter(card => card.id !== current.id)); setSelected('hermes'); window.speechSynthesis?.cancel(); }}>Remove note</button></div> : null}
      <div className="holo-voice"><h3>Ask Hermes</h3><p>Use the existing D3VONN voice session. Local notes are excluded from its context.</p><ConversationalVoiceControls context={{ surface: 'holo', route: '/holo', node_id: current?.id, ...(current?.route ? { node_label: current.title, canonical_route: current.route } : {}), ui_session_id: session }} /></div>
      <p role="status">{message}</p><p className="holo-private">Camera frames and imported notes stay on this device. Camera stops when this tab is hidden. Voice connects only when you start it.</p>
    </aside></div>
    <video ref={tracking.videoRef} muted playsInline className={`holo-video ${preview ? 'visible' : ''}`} style={{ transform: mirror ? 'scaleX(-1)' : undefined }} aria-label={preview ? 'Live camera preview' : 'Camera preview hidden'} />
  </div>;
}
