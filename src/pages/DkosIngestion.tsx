import { Helmet } from "react-helmet-async";
import { BrainCircuit, Database, FileSearch, Network } from "lucide-react";
import PublicPageShell from "@/components/shell/PublicPageShell";
import { DkosIngestionUploader } from "@/components/dkos/DkosIngestionUploader";

const breadcrumbs = [{ label: "Knowledge Graph" }, { label: "DKOS Ingestion" }];

export default function DkosIngestion() {
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

      <section className="d3-os-shell px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8" aria-labelledby="dkos-heading">
        <div className="mx-auto max-w-5xl">
          <div className="d3-chrome-panel mb-8 rounded-3xl p-6 text-center sm:mb-10 sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
              D3VONN Knowledge Operating System
            </p>
            <h1 id="dkos-heading" className="mt-4 text-4xl font-black sm:text-5xl">
              Knowledge Graph Ingestion Command
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-slate-400">
              Convert documents into Markdown, metadata, semantic chunks, knowledge graph artifacts, embeddings,
              Pinecone memory, and Hermes retrieval context.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Knowledge ingestion capabilities">
            {[
              ["Document intelligence", FileSearch],
              ["Knowledge graph", Network],
              ["Vector memory", Database],
              ["Hermes context", BrainCircuit],
            ].map(([label, Icon]) => (
              <div key={String(label)} className="d3-chrome-panel rounded-xl p-4">
                {typeof Icon !== "string" && <Icon className="h-5 w-5 text-cyan-300" aria-hidden="true" />}
                <div className="mt-3 text-xs font-semibold text-white">{String(label)}</div>
              </div>
            ))}
          </div>

          <div className="d3-chrome-panel rounded-2xl p-3 sm:p-6">
            <DkosIngestionUploader />
          </div>

          <div className="d3-chrome-panel mt-8 rounded-2xl p-5 text-sm leading-relaxed text-slate-400 sm:p-6">
            <h2 className="font-semibold text-white">Governed ingestion pipeline</h2>
            <p className="mt-2">
              Upload → Security Scan → OCR → Docling → MarkItDown → Metadata → Knowledge Graph → Semantic Chunks →
              Embeddings → Pinecone → Hermes Memory → DKOS.
            </p>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
