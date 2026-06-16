import { FormEvent, ReactNode, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Play, ShieldCheck } from "lucide-react";
import { parseCommand, registry } from "../../packages/primetime-command-engine/src/index";

const examples = [
  "PRIMETIME-360 + PROJECT-GAP + PROJECT-NEXT + TABLE: Review the complete insurance system.",
  "COMPLIANCE-360 + SMS-SEQUENCE: Create a compliant follow-up sequence.",
  "CRM-360 + TECHNICAL: Audit the lead pipeline and production readiness.",
];

export default function PrimetimeCommandConsole() {
  const [value, setValue] = useState(examples[0]);
  const [submitted, setSubmitted] = useState(value);
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => parseCommand(submitted), [submitted]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(value.trim());
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const canExecute =
    result.unknownCodes.length === 0 &&
    result.conflicts.length === 0 &&
    !result.humanApprovalRequired;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">PRIMETIME</p>
          <h1 className="text-4xl font-bold">Command Console</h1>
          <p className="max-w-3xl text-slate-400">
            Parse prompt codes, preview master-code expansion, detect conflicts, and verify approval requirements before execution.
          </p>
        </header>

        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
          <label htmlFor="command" className="mb-2 block text-sm font-semibold">Command</label>
          <textarea
            id="command"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-36 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-sm outline-none focus:border-emerald-500"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950">
              <Play size={16} /> Parse command
            </button>
            {examples.map((example, index) => (
              <button key={example} type="button" onClick={() => setValue(example)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300">
                Example {index + 1}
              </button>
            ))}
          </div>
        </form>

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Registry" value={`v${registry.version}`} />
          <Metric label="Approval level" value={String(result.approvalLevel)} />
          <Metric label="Expanded codes" value={String(result.expandedCodes.length)} />
          <Metric label="Status" value={canExecute ? "Draft-safe" : "Review required"} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Interpretation">
            <Row label="Instruction" value={result.instruction || "No instruction supplied"} />
            <Row label="Output format" value={result.outputFormat || "Default"} />
            <Row label="Human approval" value={result.humanApprovalRequired ? "Required" : "Not required"} />
            <Row label="Licensed review" value={result.licensedReviewRequired ? "Required" : "Not required"} />
          </Panel>

          <Panel title="Policy result">
            {result.unknownCodes.length === 0 && result.conflicts.length === 0 ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-700/50 bg-emerald-950/40 p-4">
                <CheckCircle2 className="mt-0.5 text-emerald-400" />
                <div><strong>Command structure accepted.</strong><p className="text-sm text-slate-400">Approval gates still apply before any operational action.</p></div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-amber-700/50 bg-amber-950/40 p-4">
                <AlertTriangle className="mt-0.5 text-amber-400" />
                <div><strong>Resolve command issues.</strong><p className="text-sm text-slate-400">Unknown codes or conflicting output instructions prevent execution.</p></div>
              </div>
            )}
            {result.humanApprovalRequired && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-blue-700/50 bg-blue-950/40 p-4"><ShieldCheck className="text-blue-400" /><span>Human approval gate enabled.</span></div>
            )}
          </Panel>

          <Panel title="Expanded commands">
            <div className="flex flex-wrap gap-2">{result.expandedCodes.map((code) => <span key={code} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold">{code}</span>)}</div>
          </Panel>

          <Panel title="Validation findings">
            <Row label="Unknown codes" value={result.unknownCodes.join(", ") || "None"} />
            <Row label="Conflicts" value={result.conflicts.map((item) => `${item.left} ↔ ${item.right}`).join(", ") || "None"} />
          </Panel>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Structured output</h2><button onClick={copyJson} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm"><Copy size={15} /> {copied ? "Copied" : "Copy JSON"}</button></div>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-emerald-300">{JSON.stringify(result, null, 2)}</pre>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-4 text-xl font-bold">{title}</h2>{children}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-b border-slate-800 py-3 last:border-0"><span className="text-slate-400">{label}</span><span className="text-right font-semibold">{value}</span></div>;
}
