import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Bot, BrainCircuit, Database, Film, Gauge, Network, Radio, Search,
  Server, ShieldCheck, Users, Workflow, Wrench, Play, Eye, Sparkles, Cpu, HardDrive,
  Bell, CircleUserRound, GitBranch, Mic
} from 'lucide-react';
import './D3VONNReferenceHome.css';

const nav = [
  ['Command Center','/command-center',Gauge],
  ['Knowledge Graph','/knowledge-graph',Network],
  ['Hermes Orchestration','/workflows',BrainCircuit],
  ['Agents','/agents',Bot],
  ['Tools & Integrations','/mcp',Wrench],
  ['Workflows','/workflows',Workflow],
  ['Knowledge & RAG','/dkos-ingestion',Database],
  ['AI Films','/ai-films',Film],
  ['HNF Ecosystem','/music',Radio],
  ['Infrastructure','/command-center',Server],
  ['Operations','/operations',Activity],
  ['Security','/security/command-center',ShieldCheck],
  ['Analytics','/app',Gauge],
];

const nodes = [
  {k:'people',title:'PEOPLE',sub:'Users · Teams · Partners',icon:Users,route:'/app'},
  {k:'knowledge',title:'KNOWLEDGE & RAG',sub:'Memory · Ontology · Search',icon:Database,route:'/dkos-ingestion'},
  {k:'models',title:'MODELS',sub:'LLM · VLM · Multimodal',icon:Cpu,route:'/app'},
  {k:'films',title:'AI FILMS',sub:'Characters · Production · VFX',icon:Film,route:'/ai-films'},
  {k:'agents',title:'AGENTS',sub:'AI Workers · Specialists',icon:Bot,route:'/agents'},
  {k:'tools',title:'TOOLS & MCP',sub:'APIs · Integrations',icon:Wrench,route:'/mcp'},
  {k:'hnf',title:'HNF ECOSYSTEM',sub:'Radio · TV · Academy · Culture',icon:Radio,route:'/music'},
  {k:'workflows',title:'WORKFLOWS',sub:'Automations · Tasks · Events',icon:Workflow,route:'/workflows'},
  {k:'infra',title:'INFRASTRUCTURE',sub:'GPU · Servers · Storage',icon:Server,route:'/command-center'},
  {k:'ops',title:'OPERATIONS',sub:'Monitoring · Jobs · Logs',icon:Activity,route:'/operations'},
  {k:'security',title:'SECURITY',sub:'Compliance · Governance',icon:ShieldCheck,route:'/security/command-center'},
];

const status = [
  ['24','Active Agents','ok'],
  ['1,248','Running Tasks','gold'],
  ['98.7%','Success Rate','blue'],
  ['100%','Uptime','violet'],
];

const activity = [
  ['2m','AI Film video generation completed','AI Films · Production'],
  ['4m','New data source indexed','RAG · Knowledge'],
  ['7m','Hermes executed 6 tasks','Orchestration'],
  ['12m','HNF Radio episode published','HNF · Production'],
  ['18m','Bridge opportunity detected','AI Films ↔ Academy'],
  ['22m','Security scan: no threats','Security · Compliance'],
];

const bridges = [
  ['AI Film Character → Academy Instructor','HIGH IMPACT'],
  ['HNF Radio → Multi-Platform Distribution','MEDIUM'],
  ['Customer Support Agent → Product Docs','MEDIUM'],
];

export default function D3VONNReferenceHome(){
  return (
    <div className="d3ref-app">
      <header className="d3ref-topbar">
        <Link to="/" className="d3ref-brand">
          <div className="d3ref-mark">D3</div>
          <div><div className="d3ref-brandword">D3VONN</div><div className="d3ref-tag">AI BUSINESS OPERATING SYSTEM</div></div>
        </Link>
        <nav className="d3ref-topnav">
          {['HOME','KNOWLEDGE GRAPH','HERMES','AGENTS','WORKFLOWS','INFRASTRUCTURE','AI FILMS','HNF','MARKETPLACE'].map((x,i)=>
            <Link key={x} className={i===1?'active':''} to={['/','/knowledge-graph','/workflows','/agents','/workflows','/command-center','/ai-films','/music','/marketplace'][i]}>{x}</Link>
          )}
        </nav>
        <div className="d3ref-head-actions">
          <div className="d3ref-search"><Search size={15}/><span>Search anything...</span></div>
          <button aria-label="Voice"><Mic size={16}/></button>
          <button aria-label="Notifications"><Bell size={16}/></button>
          <CircleUserRound size={28}/>
        </div>
      </header>

      <div className="d3ref-shell">
        <aside className="d3ref-left">
          <div className="d3ref-left-title">Command Center<span>Live overview</span></div>
          <nav>{nav.map(([label,route,Icon],idx)=><Link className={idx===1?'active':''} key={String(label)} to={String(route)}><Icon size={18}/><span>{label}</span></Link>)}</nav>
          <Link className="d3ref-institute" to="/institute"><Users size={18}/><span>D3VONN.IO INSTITUTE<small>Research · Education · Community</small></span></Link>
        </aside>

        <main className="d3ref-main">
          <section className="d3ref-stage-card">
            <div className="d3ref-stage-head">
              <div><div className="d3ref-kicker">D3VONN KNOWLEDGE UNIVERSE</div><h1>Connect Everything. Make It Work.</h1><p>People · Agents · Data · Tools · Workflows · Memory · Infrastructure · Results</p></div>
              <div className="d3ref-viewtabs"><button className="active">Graph View</button><button>Map View</button><button>List View</button></div>
            </div>
            <div className="d3ref-stage-tools"><div className="d3ref-stage-search"><Search size={14}/><span>Search nodes, projects, or ask Hermes...</span></div><div className="d3ref-node-count">◉ All Nodes <b>1,248</b></div></div>
            <div className="d3ref-graph-stage">
              <div className="d3ref-gridlines"/>
              <div className="d3ref-globe">
                {[...Array(26)].map((_,i)=><i key={i} style={{'--r':`${(i*47)%360}deg`,'--d':`${22+(i%7)*6}%`} as React.CSSProperties}/>)}
              </div>
              <div className="d3ref-ring ring1"/><div className="d3ref-ring ring2"/><div className="d3ref-ring ring3"/>
              {nodes.map(({k,title,sub,icon:Icon,route})=><Link key={k} to={route} className={`d3ref-node ${k}`}><div className="d3ref-node-orb"><Icon size={22}/></div><div className="d3ref-node-copy"><b>{title}</b><span>{sub}</span></div></Link>)}
              <div className="d3ref-hermes">
                <div className="d3ref-hermes-orbit o1"/><div className="d3ref-hermes-orbit o2"/>
                <div className="d3ref-hermes-core"><BrainCircuit size={38}/><b>HERMES</b><span>AI ORCHESTRATION</span></div>
              </div>
              <div className="d3ref-pills p1"><span>Documents</span><span>Knowledge</span></div>
              <div className="d3ref-pills p2"><span>Vector DB</span><span>Memory</span></div>
              <div className="d3ref-pills p3"><span>Voice</span><span>Vision</span><span>Reasoning</span><span>Planning</span></div>
              <div className="d3ref-pills p4"><span>MCP Servers</span><span>External APIs</span><span>Custom Tools</span><span>Connectors</span></div>
              <div className="d3ref-pills p5"><span>Task Queue</span><span>Schedulers</span><span>Event Bus</span><span>Approvals</span></div>
              <div className="d3ref-pills p6"><span>GPU Cluster</span><span>Databases</span><span>Edge Devices</span><span>Cloud</span></div>
              <div className="d3ref-pills p7"><span>Access Control</span><span>Audit Logs</span><span>Threat Detection</span><span>Policy</span></div>
            </div>
            <div className="d3ref-actions">
              <Link className="primary" to="/knowledge-graph"><Network size={16}/>Explore</Link>
              <button><Eye size={16}/>Trace</button><Link to="/workflows"><Play size={16}/>Run</Link>
              <button><GitBranch size={16}/>Connect</button><Link to="/operations"><Activity size={16}/>Monitor</Link><button><Sparkles size={16}/>AI Assist</button>
            </div>
          </section>

          <section className="d3ref-bottom">
            <div className="d3ref-exec">
              <div className="d3ref-panel-title">EXECUTION FLOW</div>
              {['Request','Plan','Agents','Execute','Memory','Verify','Complete'].map((x,i)=><div className="d3ref-step" key={x}><span>{i+1}</span><b>{x}</b><small>{['New task','Tell Hermes','Select & route','Tools & MCP','Retrieve & learn','Validation & feedback','Result & next step'][i]}</small></div>)}
            </div>
            <div className="d3ref-table-card"><div className="d3ref-panel-title">TOP AGENTS <span>View All</span></div>
              {['Video Agent','Voice Agent','Research Agent','Security Agent','Operations Agent'].map((x,i)=><div className="d3ref-row" key={x}><span>{x}</span><em>● Running</em><b>{[24,18,12,31,22][i]}</b><strong>{[100,100,99,100,98][i]}%</strong></div>)}
            </div>
            <div className="d3ref-table-card"><div className="d3ref-panel-title">INFRASTRUCTURE <span>View All</span></div>
              {[['GPU Cluster','Running','72%'],['Postgres','Healthy','34%'],['Redis','Healthy','28%'],['Vector DB','Healthy','43%'],['Edge Devices','Running','61%']].map(r=><div className="d3ref-row infra" key={r[0]}><span>{r[0]}</span><em>● {r[1]}</em><strong>{r[2]}</strong></div>)}
            </div>
            <div className="d3ref-cost"><div className="d3ref-panel-title">COST & USAGE <span>Live</span></div><div className="d3ref-big">$48.32 <small>today</small></div><div className="d3ref-bars">{[4,7,5,8,9,6,10,7,11,9,12,8,7,10,12,9,11,13,8,10].map((h,i)=><i key={i} style={{height:`${h*4}px`}}/>)}</div></div>
          </section>
        </main>

        <aside className="d3ref-right">
          <section className="d3ref-panel"><div className="d3ref-panel-title">SYSTEM STATUS <span className="live">● LIVE</span></div><div className="d3ref-stats">{status.map(([n,l,c])=><div className={`d3ref-stat ${c}`} key={l}><b>{n}</b><span>{l}</span></div>)}</div></section>
          <section className="d3ref-panel"><div className="d3ref-panel-title">RECENT ACTIVITY <span>View all</span></div><div className="d3ref-activity">{activity.map(([t,a,s],i)=><div key={a}><time>{t}</time><span className={`dot d${i}`}/><p><b>{a}</b><small>{s}</small></p></div>)}</div></section>
          <section className="d3ref-panel bridges"><div className="d3ref-panel-title">BRIDGE OPPORTUNITIES <span className="badge">3</span></div>{bridges.map(([b,p],i)=><div className="d3ref-bridge" key={b}><GitBranch size={18}/><p><b>{b}</b><small>{p} <em>{i<2?'RECOMMENDED':'NEW'}</em></small></p></div>)}</section>
        </aside>
      </div>
    </div>
  )
}
