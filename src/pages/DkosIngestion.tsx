import { Helmet } from "react-helmet-async";
import { DkosIngestionUploader } from "@/components/dkos/DkosIngestionUploader";

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

      <div className="min-h-screen bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">D3VONN Knowledge Operating System</p>
            <h1 className="mt-4 text-4xl font-black sm:text-5xl">DKOS Ingestion Command</h1>
            <p className="mx-auto mt-4 max-w-3xl text-slate-400">
              Convert documents into Markdown, metadata, semantic chunks, knowledge graph artifacts, embeddings, Pinecone memory, and Hermes retrieval context.
            </p>
          </div>

          <DkosIngestionUploader />

          <div className="mt-8 rounded-2xl border border-slate-800 bg-black/30 p-6 text-sm leading-relaxed text-slate-400">
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
