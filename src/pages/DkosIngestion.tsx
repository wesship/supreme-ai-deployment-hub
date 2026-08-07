import { Helmet } from "react-helmet-async";
import { BrainCircuit, Database, FileSearch, Network, ShieldCheck, Sparkles } from "lucide-react";
import PublicPageShell from "@/components/shell/PublicPageShell";
import { DkosIngestionUploader } from "@/components/dkos/DkosIngestionUploader";
import D3Surface, { D3SectionHeader } from "@/components/d3/D3Surface";

const breadcrumbs = [{ label: "Knowledge Graph" }, { label: "DKOS Ingestion" }];

export default function DkosIngestion() {
  const capabilities = [
    ["Document intelligence", "Docling + MarkItDown", FileSearch],
    ["Knowledge graph", "Entities + relationships", Network],
    ["Vector memory", "Embeddings + retrieval", Database],
    ["Hermes context", "Governed agent access", BrainCircuit],
  ] as const;

  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <Helmet>
        <title>Knowledge Graph & DKOS Ingestion — D3VONN.IO</title>
        <meta
          name="description"
          content="Upload documents into the D3VONN Knowledge Operating System using the governed Docling and MarkItDown ingestion pipeline."
        />
        <link rel="canonical" href="https://d3vonn.io/dkos-ingestion" />
      </Helmet>

      <section className="d3-os-shell d3-workspace-shell px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8" aria-labelledby="dkos-heading">
        <div className="mx-auto max-w-6xl">
          <D3Surface tone="titanium" className="relative overflow-hidden p-6 sm:p-10">
            <div className="pointer-events-none absolute right-[-8%] top-[-40%] h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" aria-hidden="true" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <D3SectionHeader
                eyebrow="Knowledge Operating System"
                title="Knowledge Graph Command"
                description="Transform governed source material into structured knowledge, semantic retrieval, and durable context that D3VONN.IO agents can use with source-aware intelligence."
              />
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <span className="d3-system-status"><span className="d3-status-dot" /> DKOS online</span>
                <span className="d3-system-status"><ShieldCheck className="h-3.5 w-3.5" /> governed ingestion</span>
              </div>
            </div>
          </D3Surface>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Knowledge ingestion capabilities">
            {capabilities.map(([label, detail, Icon]) => (
              <D3Surface key={label} interactive className="p-4 sm:p-5">
                <Icon className="h-5 w-5 text-blue-200" aria-hidden="true" />
                <div className="mt-4 text-sm font-semibold text-white">{label}</div>
                <div className="mt-1 text-[11px] leading-5 text-white/45">{detail}</div>
              </D3Surface>
            ))}
          </div>

          <D3Surface tone="strong" className="mt-6 p-3 sm:p-6" aria-label="Knowledge ingestion workspace">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <div className="d3-kicker">Source intake</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Ingestion Workspace</h2>
              </div>
              <Sparkles className="h-5 w-5 text-blue-200/70" aria-hidden="true" />
            </div>
            <DkosIngestionUploader />
          </D3Surface>

          <D3Surface className="mt-6 p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[0.55fr_1.45fr] lg:items-start">
              <div>
                <div className="d3-kicker">Governed pipeline</div>
                <h2 className="mt-2 text-lg font-semibold text-white">From source to operational context</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  Each stage is designed to preserve provenance while preparing information for graph reasoning, retrieval, and agent memory.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-blue-50/70" aria-label="Knowledge ingestion pipeline stages">
                {[
                  "Upload", "Security Scan", "OCR", "Docling", "MarkItDown", "Metadata",
                  "Knowledge Graph", "Semantic Chunks", "Embeddings", "Pinecone", "Hermes Memory", "DKOS",
                ].map((stage, index, stages) => (
                  <span key={stage} className="inline-flex items-center gap-2">
                    <span className="rounded-lg border border-blue-300/12 bg-blue-400/[0.045] px-2.5 py-1.5">{stage}</span>
                    {index < stages.length - 1 && <span className="text-blue-300/30" aria-hidden="true">→</span>}
                  </span>
                ))}
              </div>
            </div>
          </D3Surface>
        </div>
      </section>
    </PublicPageShell>
  );
}
