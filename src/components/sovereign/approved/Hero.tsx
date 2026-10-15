import SignalField from './SignalField';
import Logo3D from './Logo3D';

const workflow = [
  ['Choose an agent', 'Start with the right capability.'],
  ['Set a task', 'Give your work a clear direction.'],
  ['Review the work', 'Inspect the result and context.'],
  ['Approve the action', 'Keep consequential decisions yours.'],
];

export default function Hero() {
  return (
    <section id="top" className="signal-hero relative isolate overflow-hidden" aria-labelledby="signal-hero-title">
      <SignalField />
      <div className="signal-shell relative z-10">
        <div className="signal-hero__layout">
          <div className="signal-hero__copy">
            <p className="signal-eyebrow"><span className="signal-eyebrow__line" />D3VONN NETWORK // GOVERNED AI</p>
            <h1 id="signal-hero-title">INTELLIGENCE{' '}<span>UNDER YOUR{' '}</span><span className="text-signal">COMMAND.</span></h1>
            <p className="signal-hero__description">Run AI agents, organize your knowledge, and create voice and film projects from one platform—with human oversight.</p>
            <div className="signal-hero__actions">
              <a href="/app" className="btn-primary signal-button">Enter the Platform<i className="ri-arrow-right-line" aria-hidden="true" /></a>
              <a href="#platform" className="btn-ghost signal-button">Explore the Platform<i className="ri-arrow-right-line signal-chevron" aria-hidden="true" /></a>
            </div>
            <a href="/command-center" className="signal-hero__command"><i className="ri-radar-line" aria-hidden="true" />Open Command Core<i className="ri-arrow-right-line" aria-hidden="true" /></a>
          </div>
          <div className="signal-hero__visual">
            <div className="signal-hero__visual-label"><span>Sovereign Signal</span><span>Human + machine</span></div>
            <div className="signal-hero__emblem"><Logo3D /></div>
            <div className="signal-hero__surfaces" aria-label="Explore D3VONN tools">
              <a href="/agents"><i className="ri-robot-2-line" aria-hidden="true" /><span>AI Agents</span><i className="ri-arrow-right-line" aria-hidden="true" /></a>
              <a href="/ai-films"><i className="ri-film-line" aria-hidden="true" /><span>AI Films</span><i className="ri-arrow-right-line" aria-hidden="true" /></a>
              <a href="/voice-studio"><i className="ri-voiceprint-line" aria-hidden="true" /><span>Voice Studio</span><i className="ri-arrow-right-line" aria-hidden="true" /></a>
            </div>
          </div>
        </div>
        <div className="signal-workflow">
          <div className="signal-workflow__intro"><p className="signal-eyebrow">Under your command</p><p>A human-led workflow.</p></div>
          <ol aria-label="How the platform works">{workflow.map(([title, description], index) => <li key={title}><span className="signal-workflow__number">0{index + 1}</span><div><h2>{title}</h2><p>{description}</p></div></li>)}</ol>
        </div>
      </div>
    </section>
  );
}
