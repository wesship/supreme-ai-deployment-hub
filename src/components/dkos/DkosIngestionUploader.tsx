import { ChangeEvent, FormEvent, useState } from "react";
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useDkosIngestion } from "@/hooks/useDkosIngestion";

const DEFAULT_AGENT_ACCESS = ["Hermes", "Atlas", "Sapphire"];

export function DkosIngestionUploader() {
  const ingestion = useDkosIngestion();
  const [file, setFile] = useState<File | null>(null);
  const [tenantId, setTenantId] = useState("default-workspace");
  const [uploadedBy, setUploadedBy] = useState("operator");
  const [classification, setClassification] = useState<"public" | "internal" | "confidential" | "restricted">("internal");

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;

    await ingestion.start({
      file,
      tenantId,
      uploadedBy,
      classification,
      agentAccess: DEFAULT_AGENT_ACCESS,
    }).catch(() => null);
  };

  const activeStage = ingestion.run?.currentStage || ingestion.startResponse?.current_stage;
  const completed = ingestion.run?.status === "completed";
  const failed = ingestion.run?.status === "failed";

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-300">
          <UploadCloud className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">DKOS Ingestion</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Upload documents into Hermes memory</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Starts the server-side Docling to MarkItDown pipeline, then prepares metadata, semantic chunks, knowledge graph artifacts, embeddings, and DKOS retrieval records.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2 rounded-xl border border-dashed border-slate-700 bg-black/30 p-5 text-sm text-slate-300">
          <span className="block font-medium text-white">Source document</span>
          <span className="mt-1 block text-slate-500">PDF, DOCX, PPTX, XLSX, HTML, image, SOP, report, or contract.</span>
          <input className="mt-4 block w-full text-sm" type="file" onChange={onFileChange} />
        </label>

        <label className="text-sm text-slate-300">
          <span className="mb-2 block font-medium text-white">Tenant / workspace</span>
          <input
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-400"
          />
        </label>

        <label className="text-sm text-slate-300">
          <span className="mb-2 block font-medium text-white">Uploaded by</span>
          <input
            value={uploadedBy}
            onChange={(event) => setUploadedBy(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-400"
          />
        </label>

        <label className="text-sm text-slate-300">
          <span className="mb-2 block font-medium text-white">Classification</span>
          <select
            value={classification}
            onChange={(event) => setClassification(event.target.value as typeof classification)}
            className="w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-400"
          >
            <option value="public">Public</option>
            <option value="internal">Internal</option>
            <option value="confidential">Confidential</option>
            <option value="restricted">Restricted</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={!file || ingestion.isStarting || ingestion.isPolling}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(ingestion.isStarting || ingestion.isPolling) ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Start ingestion
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-slate-800 bg-black/30 p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {completed ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : null}
          {failed || ingestion.error ? <AlertTriangle className="h-5 w-5 text-amber-300" /> : null}
          {(ingestion.isStarting || ingestion.isPolling) ? <Loader2 className="h-5 w-5 animate-spin text-cyan-300" /> : null}
          <span className="text-slate-400">Status:</span>
          <span className="font-medium capitalize text-white">{ingestion.run?.status || ingestion.startResponse?.status || "idle"}</span>
          {activeStage ? <span className="text-slate-500">Stage: <span className="text-cyan-300">{activeStage}</span></span> : null}
        </div>

        {ingestion.error ? <p className="mt-3 text-sm text-amber-300">{ingestion.error}</p> : null}
        {ingestion.startResponse ? <p className="mt-3 text-xs text-slate-500">Run ID: {ingestion.startResponse.run_id}</p> : null}

        {ingestion.artifacts?.artifacts?.length ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-white">Artifacts</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {ingestion.artifacts.artifacts.map((artifact) => (
                <li key={`${artifact.kind}-${artifact.path}`}>{artifact.kind}: {artifact.path}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
