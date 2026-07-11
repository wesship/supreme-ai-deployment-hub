import { Helmet } from "react-helmet-async";
import { DkosIngestionUploader } from "@/components/dkos/DkosIngestionUploader";
import { BrainCircuit, Database, FileSearch, Network } from "lucide-react";

export default function DkosIngestion() {
  return (
    <>
      <Helmet>
        <title>DKOS Ingestion — D3VONN.IO</title>
        <meta
          name="description"
          content="Upload documents into the D3VONN Knowledge Operating System using the server-side Docling and MarkItDown ingestion pipeline."
        />
      </Helmet>

      <div className="d3-os-shell min-h-screen px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="d3-chrome-panel mb-8 rounded-3xl p-6 text-center sm:mb-10 sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">D3VONN Knowledge Operating System</p>
            <h1 className="mt-4 text-4xl font-black sm:text-5xl">DKOS Ingestion Command</h1>
            <p className="mx-auto mt-4 max-w-3xl text-slate-400">
              Convert documents into Markdown, metadata, semantic chunks, knowledge graph artifacts, embeddings, Pinecone memory, and Hermes retrieval context.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Document intelligence', FileSearch],
              ['Knowledge graph', Network],
              ['Vector memory', Database],
              ['Hermes context', BrainCircuit],
            ].map(([label, Icon]) => (
              <div key={String(label)} className="d3-chrome-panel rounded-xl p-4">
                {typeof Icon !== 'string' && <Icon className="h-5 w-5 text-cyan-300" aria-hidden="true" />}
                <div className="mt-3 text-xs font-semibold text-white">{String(label)}</div>
              </div>
            ))}
          </div>
          <div className="d3-chrome-panel rounded-2xl p-3 sm:p-6">
            <DkosIngestionUploader />
          </div>

          <div className="d3-chrome-panel mt-8 rounded-2xl p-5 text-sm leading-relaxed text-slate-400 sm:p-6">
            <p className="font-semibold text-white">Pipeline</p>
            <p className="mt-2">
              Upload → Security Scan → OCR → Docling → MarkItDown → Metadata → Knowledge Graph → Semantic Chunks → Embeddings → Pinecone → Hermes Memory → DKOS.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
