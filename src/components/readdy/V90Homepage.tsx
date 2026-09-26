import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import HomepageCTAGroup from '@/components/homepage/HomepageCTAGroup';
import type { HomepageTelemetry } from '@/lib/homepageTelemetry';
import ReaddyIcon, { type ReaddyIconName } from './IconAdapter';

const ASSET_ROOT = '/readdy-v90';

const surfaces: Array<{
  icon: ReaddyIconName;
  name: string;
  description: string;
  to: string;
}> = [
  { icon: 'agents', name: 'AI Agents', description: 'Deploy agents that act with human oversight.', to: '/ai-agents' },
  { icon: 'film', name: 'AI Films', description: 'Generate cinematic stories end to end.', to: '/film' },
  { icon: 'mic', name: 'Voice Intelligence', description: 'Systems that listen, think, and respond.', to: '/voice-studio' },
  { icon: 'workflow', name: 'Automation', description: 'Orchestrate workflows across your stack.', to: '/business-automation' },
  { icon: 'palette', name: 'Creative Studios', description: 'Tooling for creators and production teams.', to: '/solutions' },
  { icon: 'database', name: 'Sovereign Infrastructure', description: 'Cloud-to-local execution, under your control.', to: '/solutions' },
];

const branches: Array<{ icon: ReaddyIconName; name: string; angle: number }> = [
  { icon: 'agents', name: 'AI Agents', angle: 300 },
  { icon: 'film', name: 'AI Films', angle: 0 },
  { icon: 'mic', name: 'Voice', angle: 60 },
  { icon: 'workflow', name: 'Automation', angle: 120 },
  { icon: 'palette', name: 'Creative', angle: 180 },
  { icon: 'database', name: 'Infrastructure', angle: 240 },
];

const filmFrames = [
  { src: `${ASSET_ROOT}/film-frame-01.jpg`, code: 'SC-01 // TERMINUS', title: 'The Long March' },
  { src: `${ASSET_ROOT}/film-frame-02.jpg`, code: 'SC-02 // RELIC', title: 'The Vault' },
  { src: `${ASSET_ROOT}/film-frame-03.jpg`, code: 'SC-03 // DISTRICT', title: 'After Rain' },
  { src: `${ASSET_ROOT}/film-frame-04.jpg`, code: 'SC-04 // ABYSS', title: 'The Needle' },
  { src: `${ASSET_ROOT}/film-frame-05.jpg`, code: 'SC-05 // SIGNAL', title: 'First Contact' },
  { src: `${ASSET_ROOT}/film-frame-06.jpg`, code: 'SC-06 // ASCENT', title: 'The Crossing' },
];

const workflow = [
  { icon: 'story' as const, label: 'Story development' },
  { icon: 'user' as const, label: 'Character continuity' },
  { icon: 'palette' as const, label: 'Scene generation' },
  { icon: 'sound' as const, label: 'Voice & sound' },
  { icon: 'clapperboard' as const, label: 'Rendering' },
  { icon: 'arrow' as const, label: 'Distribution' },
];

const telemetryItems = (telemetry: HomepageTelemetry) => [
  { label: 'Active agents', value: telemetry.activeAgents, icon: 'agents' as const, to: '/ai-agents' },
  { label: 'Completed workflows', value: telemetry.workflowsToday, icon: 'workflow' as const, to: '/business-automation' },
  { label: 'Tasks processed', value: telemetry.knowledgeNodes, icon: 'network' as const, to: '/dkos-ingestion' },
  { label: 'System status', value: telemetry.systemStatus, icon: 'shield' as const, to: '/security' },
];

interface SectionHeaderProps {
  id?: string;
  index?: string;
  label: string;
  title: ReactNode;
  copy?: string;
  centered?: boolean;
}

/** Source-derived V90 section heading; always visible without a JS reveal observer. */
function SectionHeader({ id, index, label, title, copy, centered = false }: SectionHeaderProps) {
  return (
    <div className={`rv-section-header ${centered ? 'rv-section-header--centered' : ''}`}>
      <div className="rv-eyebrow">
        {index ? <span className="rv-section-index">{index}</span> : null}
        <span className="rv-eyebrow-line" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <h2 id={id}>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}

function SignalField() {
  const particles = Array.from({ length: 30 }, (_, index) => ({
    left: `${(index * 37) % 101}%`,
    bottom: `${8 + ((index * 23) % 43)}%`,
    delay: `${(index % 8) * -1.2}s`,
    duration: `${15 + (index % 6) * 2}s`,
  }));

  return (
    <div className="rv-signal-field" aria-hidden="true">
      <div className="rv-signal-field__grid" />
      <div className="rv-signal-field__glow rv-signal-field__glow--one" />
      <div className="rv-signal-field__glow rv-signal-field__glow--two" />
      {particles.map((particle, index) => (
        <span
          key={index}
          className="rv-signal-field__particle"
          style={{ left: particle.left, bottom: particle.bottom, animationDelay: particle.delay, animationDuration: particle.duration }}
        />
      ))}
      <span className="rv-signal-field__sweep" />
    </div>
  );
}

function Hero({ telemetry }: { telemetry: HomepageTelemetry }) {
  return (
    <section id="top" className="rv-hero" aria-labelledby="rv-hero-title">
      <SignalField />
      <div className="rv-shell rv-hero__content">
        <p className="rv-network-label"><span aria-hidden="true" />D3VONN NETWORK // PRESENTATION LAYER<span aria-hidden="true" /></p>
        <div className="rv-hero__logo-frame">
          <div className="rv-hero__logo-depth" aria-hidden="true" />
          <img
            src={`${ASSET_ROOT}/final-cta-emblem.webp`}
            alt="D3VONN signal emblem"
            width={512}
            height={512}
            className="rv-hero__logo"
            loading="eager"
            decoding="async"
          />
        </div>
        <div className="rv-hero__copy">
          <h1 id="rv-hero-title">INTELLIGENCE <span>UNDER YOUR COMMAND.</span></h1>
          <p>Build, deploy, and direct governed AI systems from one expanding creative and operational ecosystem.</p>
          <HomepageCTAGroup
            className="rv-hero__cta"
            primaryLabel="Enter D3VONN.IO"
            secondaryLabel="Explore the platform"
            secondaryTo="/solutions"
          />
          <Link className="rv-text-cta" to="/occ"><ReaddyIcon name="radio" aria-hidden="true" />Operator access — admin sign-in required<ReaddyIcon name="arrow" aria-hidden="true" /></Link>
        </div>
        <div className="rv-hero__telemetry" aria-label="Public homepage telemetry">
          <div className="rv-hero__telemetry-title">
            <span>Public homepage telemetry</span>
            <small>Public values only; unavailable data uses safe defaults.</small>
          </div>
          <div className="rv-telemetry-grid">
            {telemetryItems(telemetry).map((item) => (
              <Link key={item.label} to={item.to} className="rv-telemetry-card">
                <ReaddyIcon name={item.icon} aria-hidden="true" />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </Link>
            ))}
          </div>
        </div>
        <a className="rv-scroll-cue" href="#platform"><span>Scroll to explore</span><i aria-hidden="true" /></a>
      </div>
    </section>
  );
}

function SignalRail() {
  const categories = ['AI Agents', 'AI Films', 'Voice', 'Automation', 'Local Inference', 'Creative Systems', 'Deployment'];
  return (
    <div className="rv-signal-rail" aria-label="D3VONN platform capabilities">
      <div className="rv-signal-rail__track">
        {[...categories, ...categories].map((category, index) => <span key={`${category}-${index}`}>{category}<i aria-hidden="true" /></span>)}
      </div>
    </div>
  );
}

function Platform() {
  return (
    <section id="platform" className="rv-section rv-platform" aria-labelledby="rv-platform-title">
      <div className="rv-shell">
        <SectionHeader id="rv-platform-title" index="01" label="The Platform" title={<>One Signal. Multiple Systems.</>} copy="D3VONN.IO is a single operating environment connecting intelligent capabilities — not a set of separate companies. Each surface is an instrument panel embedded in the same command layer." />
        <div className="rv-platform__layout">
          <div className="rv-glass rv-platform-map">
            <div className="rv-platform-map__meta"><span>Core // presentation map</span><span><i />Illustrative</span></div>
            <div className="rv-platform-map__graph" aria-label="Illustrative D3VONN platform map">
              <span className="rv-platform-map__radar" aria-hidden="true" />
              <span className="rv-platform-map__ring" aria-hidden="true" />
              {branches.map((branch) => {
                const radians = (branch.angle * Math.PI) / 180;
                const x = 50 + 37 * Math.cos(radians);
                const y = 50 + 37 * Math.sin(radians);
                return (
                  <div key={branch.name} className="rv-platform-map__node" style={{ left: `${x}%`, top: `${y}%` }}>
                    <ReaddyIcon name={branch.icon} aria-hidden="true" />
                    <span>{branch.name}</span>
                  </div>
                );
              })}
              <div className="rv-platform-map__core"><span aria-hidden="true" /><strong>D3VONN Core</strong><small>Command layer</small></div>
            </div>
            <div className="rv-platform-map__stats"><div><b>6</b><span>Surfaces</span></div><div><b>1</b><span>Command</span></div><div><b>∞</b><span>Signals</span></div></div>
          </div>
          <div className="rv-surface-grid">
            {surfaces.map((surface, index) => (
              <Link key={surface.name} to={surface.to} className="rv-glass rv-surface-card">
                <div><ReaddyIcon name={surface.icon} aria-hidden="true" /><small>0{index + 1}</small></div>
                <h3>{surface.name}</h3>
                <p>{surface.description}</p>
                <span>Open surface <ReaddyIcon name="arrow" aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Agents() {
  const agentRows: Array<[string, string, string, ReaddyIconName]> = [
    ['Orion', 'Orchestrator', 'Supervising', 'radio' as const],
    ['Scribe', 'Research', 'Reviewing', 'research' as const],
    ['Atlas', 'Data Ops', 'Ready', 'database' as const],
    ['Echo', 'Voice', 'Standby', 'mic' as const],
  ];
  const taskRows: Array<[string, string]> = [['Summarize market brief', 'Complete'], ['Draft release notes', 'Illustrative'], ['Generate film treatment', 'Queued']];
  return (
    <section id="agents" className="rv-section rv-agents" aria-labelledby="rv-agents-title">
      <div className="rv-shell">
        <div className="rv-section-with-action">
          <SectionHeader id="rv-agents-title" index="02" label="AI Agents" title={<>Intelligence Built to Act.</>} copy="Controlled autonomy with observability and human command. Agents execute tasks, while consequential actions pass through a human checkpoint." />
          <Link to="/ai-agents" className="rv-secondary-button">Explore AI Agents <ReaddyIcon name="arrow" aria-hidden="true" /></Link>
        </div>
        <div className="rv-glass rv-console">
          <div className="rv-console__header"><span><i />Agent Orchestration Console</span><small>Illustrative interface — not live runtime data</small></div>
          <div className="rv-console__grid">
            <div className="rv-console__column"><p>Agent identities</p>{agentRows.map(([name, role, state, icon]) => <div className="rv-agent-row" key={name}><ReaddyIcon name={icon} aria-hidden="true" /><span><b>{name}</b><small>{role}</small></span><em>{state}</em></div>)}</div>
            <div className="rv-console__column"><p>Task queue</p>{taskRows.map(([task, state], index) => <div className="rv-task-row" key={task}><ReaddyIcon name={index === 0 ? 'check' : index === 1 ? 'document' : 'workflow'} aria-hidden="true" /><span>{task}</span><em>{state}</em>{index === 1 ? <i className="rv-static-progress" aria-hidden="true" /> : null}</div>)}</div>
            <div className="rv-console__column rv-console__activity"><p>Reference activity</p><div><span>/ web_search</span><em>example</em></div><div><span>/ doc_reader</span><em>example</em></div><div><span>/ render_engine</span><em>queued</em></div><hr /><small>Memory state</small><div className="rv-memory-bar" aria-hidden="true"><span /></div><p className="rv-muted">Context retained // human-verified</p><aside><ReaddyIcon name="shield" aria-hidden="true" /><span><b>Human approval checkpoint</b><small>Illustrative control pattern; actual approvals are governed in D3VONN.</small></span></aside></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Films() {
  return (
    <section id="films" className="rv-section rv-films" aria-labelledby="rv-films-title">
      <div className="rv-shell">
        <div className="rv-section-with-action">
          <SectionHeader id="rv-films-title" index="03" label="AI Films" title={<>Stories Generated at the Speed of Imagination.</>} copy="A complete cinematic pipeline — story, character continuity, scene generation, sound, rendering, and distribution — inside one production environment." />
          <Link to="/film" className="rv-primary-button">Enter AI Films <ReaddyIcon name="arrow" aria-hidden="true" /></Link>
        </div>
        <div className="rv-glass rv-film-window">
          <div className="rv-film-window__chrome"><span><i /><i /><i />D3VONN Film Studio</span><small>Presentation visual // 2.39:1</small></div>
          <div className="rv-film-window__hero"><img src={`${ASSET_ROOT}/films-hero-frame.jpg`} width={1613} height={900} alt="Cinematic desert signal frame from the Readdy V90 presentation" loading="lazy" decoding="async" /><span>Illustrative presentation frame</span><small>SEQ. 07 — THE SIGNAL RISES</small></div>
          <div className="rv-film-workflow">{workflow.map((item) => <div key={item.label}><ReaddyIcon name={item.icon} aria-hidden="true" /><span>{item.label}</span></div>)}</div>
        </div>
        <div className="rv-film-strip" role="region" tabIndex={0} aria-label="D3VONN AI Films presentation frames">
          {filmFrames.map((frame) => <div key={frame.code} className="rv-film-card"><img src={frame.src} width={1290} height={720} alt={`${frame.title} cinematic presentation frame`} loading="lazy" decoding="async" /><div><small>{frame.code}</small><b>{frame.title}</b></div><ReaddyIcon name="play" aria-hidden="true" /></div>)}
        </div>
      </div>
    </section>
  );
}

function Infrastructure() {
  const capabilities: Array<{ icon: ReaddyIconName; label: string }> = [
    { icon: 'cloud', label: 'Secure cloud deployment' }, { icon: 'cpu', label: 'Local GPU execution' }, { icon: 'lock', label: 'Private workflows' }, { icon: 'workflow', label: 'Provider routing' }, { icon: 'network', label: 'Open-source model support' }, { icon: 'user', label: 'Human-controlled permissions' },
  ];
  const nodes: Array<{ icon: ReaddyIconName; name: string; detail: string }> = [
    { icon: 'cloud', name: 'Secure Cloud', detail: 'Managed remote execution' }, { icon: 'monitor', name: 'Local Node', detail: 'Private on-device inference' }, { icon: 'cpu', name: 'GPU Workstation', detail: 'High-throughput local compute' },
  ];
  return (
    <section id="infrastructure" className="rv-section rv-infrastructure" aria-labelledby="rv-infrastructure-title">
      <div className="rv-shell">
        <SectionHeader id="rv-infrastructure-title" index="04" label="Sovereign Infrastructure" title={<>Own the Intelligence Layer.</>} copy="Run where it makes sense — secure cloud, your local machine, or a dedicated GPU node — with provider routing and permissions you control. Choice, portability, and resilience." />
        <div className="rv-infrastructure__grid">
          <div className="rv-capability-grid">{capabilities.map((capability) => <Link key={capability.label} to="/solutions" className="rv-glass rv-capability"><ReaddyIcon name={capability.icon} aria-hidden="true" /><span>{capability.label}</span></Link>)}</div>
          <div className="rv-glass rv-infrastructure-map"><div className="rv-infrastructure-map__core"><i />D3VONN Core // reference routing & permissions</div><div className="rv-infrastructure-map__nodes">{nodes.map((node) => <div key={node.name}><span className="rv-infrastructure-map__line" aria-hidden="true" /><aside><ReaddyIcon name={node.icon} aria-hidden="true" /><b>{node.name}</b><small>{node.detail}</small></aside></div>)}</div><p>Illustrative architecture visual // execution policies remain governed by canonical D3VONN controls</p></div>
        </div>
      </div>
    </section>
  );
}

function Voice() {
  const features: Array<{ icon: ReaddyIconName; label: string }> = [{ icon: 'mic', label: 'Voice-enabled interaction' }, { icon: 'keyboard', label: 'Text fallback' }, { icon: 'sound', label: 'Natural response' }];
  return (
    <section id="voice" className="rv-section rv-voice" aria-labelledby="rv-voice-title">
      <div className="rv-shell rv-voice__layout">
        <div><SectionHeader id="rv-voice-title" index="05" label="Voice & Interaction" title={<>Speak to the System.</>} copy="Voice is a first-class control — but never the only one. Text and keyboard remain fully available through the canonical Voice Studio." /><div className="rv-voice-features">{features.map((feature) => <div key={feature.label}><ReaddyIcon name={feature.icon} aria-hidden="true" /><span>{feature.label}</span></div>)}</div></div>
        <div className="rv-glass rv-voice-panel"><div className="rv-voice-panel__aperture" aria-hidden="true"><span /><span /><span /><ReaddyIcon name="mic" /></div><p>Voice Studio is ready</p><div className="rv-waveform" aria-hidden="true">{Array.from({ length: 32 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 11) % 72)}%` }} />)}</div><div className="rv-voice-panel__notice">This is a presentation preview. It does not access your microphone or simulate a conversation.</div><Link to="/voice-studio" className="rv-primary-button">Open Voice Studio <ReaddyIcon name="arrow" aria-hidden="true" /></Link></div>
      </div>
    </section>
  );
}

function Manifesto() {
  return (
    <section id="about" className="rv-section rv-manifesto" aria-labelledby="rv-manifesto-title">
      <div className="rv-shell rv-manifesto__layout">
        <figure><img src={`${ASSET_ROOT}/manifesto-hands.jpg`} width={1000} height={1241} alt="Human hands and a luminous blue machine core from the Readdy V90 presentation" loading="lazy" decoding="async" /><figcaption>Origin // Humanity + Machine</figcaption></figure>
        <div className="rv-manifesto__copy"><div className="rv-eyebrow"><span className="rv-section-index">06</span><span className="rv-eyebrow-line" aria-hidden="true" /><span>About / Manifesto</span></div><h2 id="rv-manifesto-title">Technology Should Expand Human Ability.</h2><blockquote>“All animals have ability and strength. What separates humanity is our capacity to imagine, create, cooperate, and build beyond the limits of instinct. D3VONN exists to turn that capacity into systems that move people and ideas forward.”</blockquote><p><ReaddyIcon name="quote" aria-hidden="true" /><span><b>The D3VONN Principle</b><small>Signal over noise · Command over chaos</small></span></p></div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="signal" className="rv-final-cta" aria-labelledby="rv-final-cta-title">
      <div className="rv-final-cta__emblem" aria-hidden="true"><span /><span /><img src={`${ASSET_ROOT}/final-cta-emblem.webp`} width={512} height={512} alt="" loading="lazy" decoding="async" /></div>
      <div className="rv-shell rv-final-cta__content"><p>D3VONN NETWORK // TRANSMISSION COMPLETE</p><h2 id="rv-final-cta-title">THE SIGNAL IS YOURS.</h2><span>Enter the D3VONN ecosystem and put intelligent systems under your command.</span><HomepageCTAGroup className="rv-final-cta__actions" primaryLabel="Launch D3VONN" secondaryLabel="Explore the ecosystem" secondaryTo="/solutions" /></div>
    </section>
  );
}

export interface V90HomepageProps {
  telemetry: HomepageTelemetry;
}

/**
 * Adapted from Readdy project dd3b402e-1da4-4fe4-954a-fad4fe9e7515 V90 (version 13627923).
 * It is presentation-only: the canonical application shell, auth, APIs, data, and runtime stay outside this component.
 */
export default function V90Homepage({ telemetry }: V90HomepageProps) {
  return (
    <div className="readdy-v90">
      <Hero telemetry={telemetry} />
      <SignalRail />
      <Platform />
      <Agents />
      <Films />
      <Infrastructure />
      <Voice />
      <Manifesto />
      <FinalCTA />
    </div>
  );
}
