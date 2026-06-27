import { useState } from "react";

const BRAND = {
  accent: "#7FD7FF",
  accentSoft: "#7FD7FF22",
  bg: "#060606",
  panel: "#0d0d0d",
  panelSoft: "#0a0a0a",
  border: "#1e293b",
  borderSoft: "#1a1a1a",
  text: "#d4d4d4",
  muted: "#777",
  dim: "#ffffff55",
  warn: "#ffb86b",
};

const CONTENT = {
  twitter: [
    {
      label: "Builder Hook",
      text: `I built a self-healing AI mesh that auto-deploys, auto-recovers, and orchestrates multiple services with one command.\n\nNo bloated team. No locked-in platform.\n\nJust sovereign AI infrastructure.\n\nMeet DEVONN.AI 👁️ → d3vonn.io`,
    },
    {
      label: "Tech Stack Flex",
      text: `DEVONN.AI stack:\n\n⚡ FastAPI on Railway\n🧠 Hermes orchestrator with HITL approval\n🗄️ Supabase + Pinecone RAG\n🔐 JWT + Zero-Trust HMAC\n📦 500+ tests\n🌐 Vercel frontend live\n\nBuilt by one founder.\n\nd3vonn.io`,
    },
    {
      label: "Pain Point",
      text: `Most AI platforms:\n→ Lock you into their infra\n→ Hide what agents are doing\n→ Break when you need them most\n\nDEVONN.AI:\n→ You control the infrastructure\n→ Every agent action is auditable\n→ The mesh can recover automatically\n\nd3vonn.io`,
    },
  ],
  tiktok: [
    {
      label: "Explainer",
      text: `Hook: "This one command starts my AI company."\n\nShow: bash run_all.sh → Hermes dispatches agents → API gateway routes requests → auto-healer reacts if anything breaks\n\nCaption: Sovereign AI infrastructure at d3vonn.io`,
    },
    {
      label: "Tech Tour",
      text: `Hook: "Let me show you what a self-healing AI mesh looks like."\n\nShow: GitHub repo tour → backend → frontend → policy engine → live dashboard\n\nCaption: Built different. d3vonn.io`,
    },
  ],
  linkedin: [
    {
      label: "Founder Post",
      text: `When people ask how I run an AI platform solo, I show them the mesh.\n\nDEVONN.AI is a multi-agent autonomous infrastructure system built for deployment, auditability, and control.\n\nHere's what's under the hood:\n\n• Hermes orchestrator with human-in-the-loop approval for sensitive actions\n• FastAPI gateway proxying AI services behind authenticated routes\n• Supabase + Pinecone RAG pipeline\n• Policy engine enforcing DENY > REQUIRE_APPROVAL > ALLOW\n• Immutable audit trail for agent actions\n• Frontend live on Vercel with backend services on Railway\n• Edge-ready architecture designed for local and cloud execution\n\nThis is what infrastructure ownership looks like when you're not waiting on a team, a vendor, or a locked-in platform.\n\nPrivate beta access is opening for builders, founders, and operators who want autonomous infrastructure they can actually control.\n\nSee it at d3vonn.io`,
    },
  ],
  email: [
    {
      label: "Cold Outreach — Founders",
      subject: "Built a self-healing AI mesh — thought you'd want to see it",
      text: `Hey [Name],\n\nI'm Wesley, founder of DEVONN.AI.\n\nI built a multi-agent autonomous infrastructure system that coordinates AI services through a unified command layer. Hermes, the orchestrator, dispatches agents, routes requests through a FastAPI gateway, and supports recovery workflows with human approval gates for sensitive actions.\n\nDEVONN.AI is built for people who want AI infrastructure they can control, audit, and extend — not another black-box SaaS layer.\n\nPrivate beta access is opening for a small group of builders, founders, and operators.\n\nInterested in a walkthrough?\n\n— Wesley\nd3vonn.io`,
    },
  ],
  github: {
    label: "GitHub README Badge Block",
    text: `> **DEVONN.AI** — Autonomous Multi-Agent Infrastructure Platform\n>\n> One command. Multi-service orchestration. Self-healing mesh.\n>\n> 🌐 [d3vonn.io](https://d3vonn.io) · 📦 500+ tests · 🚀 Private Beta\n\n[![Live](https://img.shields.io/badge/status-live-blue)](https://d3vonn.io)\n[![Tests](https://img.shields.io/badge/tests-500%2B-blue)](https://github.com/wesship/supreme-ai-deployment-hub/actions)\n[![Beta](https://img.shields.io/badge/private_beta-opening-silver)](https://d3vonn.io)`,
  },
};

const CHANNELS = [
  { key: "twitter", label: "𝕏 / Twitter" },
  { key: "tiktok", label: "TikTok" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "email", label: "Email" },
  { key: "github", label: "GitHub" },
];

function getChannelCopy(active) {
  const items = CONTENT[active];
  if (!items) return "";
  if (active === "github") return items.text;

  return items
    .map((item) => {
      const subject = item.subject ? `Subject: ${item.subject}\n\n` : "";
      return `${item.label}\n\n${subject}${item.text}`;
    })
    .join("\n\n---\n\n");
}

function CopyButton({ text, label = "content" }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 2200);
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      style={{
        background: copied ? BRAND.accentSoft : "#ffffff0f",
        border: `1px solid ${copied ? BRAND.accent : "#ffffff22"}`,
        color: copied ? BRAND.accent : failed ? "#ff8a8a" : "#aaa",
        borderRadius: 6,
        padding: "6px 14px",
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
        cursor: "pointer",
        transition: "all 0.2s",
        letterSpacing: "0.05em",
      }}
    >
      {copied ? "COPIED ✓" : failed ? "FAILED" : "COPY"}
    </button>
  );
}

function Card({ label, text, subject, active }) {
  const copyText = subject ? `Subject: ${subject}\n\n${text}` : text;
  const isTwitter = active === "twitter";
  const isOverLimit = isTwitter && text.length > 280;

  return (
    <div
      style={{
        background: BRAND.panel,
        border: `1px solid ${BRAND.border}`,
        borderRadius: 10,
        padding: "18px 20px",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: BRAND.accent, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</span>
        <CopyButton text={copyText} label={label} />
      </div>

      <div style={{ fontSize: 11, color: isOverLimit ? BRAND.warn : BRAND.muted, marginBottom: 10, letterSpacing: "0.04em" }}>
        {text.length} characters{isOverLimit ? " · over X short-post limit" : ""}
      </div>

      {subject && (
        <div style={{ fontSize: 12, color: BRAND.dim, marginBottom: 8, borderBottom: `1px solid ${BRAND.borderSoft}`, paddingBottom: 8 }}>
          Subject: <span style={{ color: "#ffffff99" }}>{subject}</span>
        </div>
      )}

      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: BRAND.text, lineHeight: 1.7, overflowWrap: "break-word" }}>
        {text}
      </pre>
    </div>
  );
}

export default function MarketingCommandCenter() {
  const [active, setActive] = useState("twitter");

  const renderContent = () => {
    const items = CONTENT[active];
    if (!items) return null;
    if (active === "github") return <Card label={items.label} text={items.text} active={active} />;
    return items.map((item, i) => <Card key={`${active}-${i}`} label={item.label} text={item.text} subject={item.subject} active={active} />);
  };

  return (
    <main style={{ minHeight: "100vh", background: BRAND.bg, fontFamily: "'JetBrains Mono', monospace", color: "#fff", padding: "0 0 60px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header style={{ borderBottom: `1px solid ${BRAND.borderSoft}`, padding: "28px 24px 20px" }}>
          <div style={{ fontSize: 11, color: BRAND.accent, letterSpacing: "0.2em", marginBottom: 6, textTransform: "uppercase" }}>
            DEVONN.AI — Promo Command Center
          </div>

          <h1 style={{ margin: 0, fontSize: 24, fontFamily: "system-ui, sans-serif", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>
            d3vonn.io
          </h1>

          <p style={{ fontSize: 12, color: BRAND.muted, marginTop: 6 }}>
            Autonomous AI infrastructure · multi-agent orchestration · private beta
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            <a href="https://d3vonn.io" target="_blank" rel="noreferrer" style={{ color: BRAND.bg, background: BRAND.accent, textDecoration: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700 }}>
              OPEN D3VONN.IO
            </a>

            <CopyButton text={getChannelCopy(active)} label={`all ${active} content`} />
          </div>
        </header>

        <nav aria-label="Promo content channels" style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BRAND.borderSoft}`, overflowX: "auto" }}>
          {CHANNELS.map((ch) => (
            <button
              key={ch.key}
              onClick={() => setActive(ch.key)}
              aria-pressed={active === ch.key}
              style={{
                background: "none",
                border: "none",
                borderBottom: active === ch.key ? `2px solid ${BRAND.accent}` : "2px solid transparent",
                color: active === ch.key ? BRAND.accent : "#666",
                padding: "12px 20px",
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
                letterSpacing: "0.05em",
              }}
            >
              {ch.label}
            </button>
          ))}
        </nav>

        <section style={{ padding: "24px 24px 0" }}>{renderContent()}</section>

        <footer style={{ margin: "32px 24px 0", padding: "16px", background: BRAND.panelSoft, border: `1px solid ${BRAND.borderSoft}`, borderRadius: 8, fontSize: 11, color: "#555", letterSpacing: "0.05em", lineHeight: 1.6 }}>
          GITHUB → github.com/wesship/supreme-ai-deployment-hub &nbsp;·&nbsp; LIVE → d3vonn.io
        </footer>
      </div>
    </main>
  );
}
