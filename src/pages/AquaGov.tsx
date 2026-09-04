import { useMemo, useState } from "react";
import { Download, FileJson, FileText, MapPinned, ShieldCheck, Upload, Waves } from "lucide-react";

type ParticipationLevel = "attended" | "participated" | "influenced" | "decided";
type EvidenceKind = "observed" | "reconstructed" | "inferred" | "verified";

type FieldRecord = {
  record_id: string;
  site_id: string;
  site_name: string;
  latitude: number;
  longitude: number;
  water_source_type: string;
  water_source_distance_m: number;
  observation_date: string;
  participant_id: string;
  gender: string;
  role: string;
  attendance: boolean;
  participation_level: ParticipationLevel;
  decision_influence: number;
  decision_authority: number;
  decision_outcome: string;
  observer_notes: string;
  evidence: EvidenceKind;
};

const demoRecords: FieldRecord[] = [
  {
    record_id: "demo-001",
    site_id: "SHO-001",
    site_name: "Example Water Point A",
    latitude: 5.8501,
    longitude: 0.0684,
    water_source_type: "Borehole",
    water_source_distance_m: 340,
    observation_date: "2026-08-01",
    participant_id: "DEMO-P01",
    gender: "Woman",
    role: "Community member",
    attendance: true,
    participation_level: "participated",
    decision_influence: 0.42,
    decision_authority: 0.2,
    decision_outcome: "Spoke on maintenance timing",
    observer_notes: "Prototype record only.",
    evidence: "observed",
  },
  {
    record_id: "demo-002",
    site_id: "SHO-001",
    site_name: "Example Water Point A",
    latitude: 5.8501,
    longitude: 0.0684,
    water_source_type: "Borehole",
    water_source_distance_m: 340,
    observation_date: "2026-08-01",
    participant_id: "DEMO-P02",
    gender: "Man",
    role: "Committee member",
    attendance: true,
    participation_level: "decided",
    decision_influence: 0.82,
    decision_authority: 0.9,
    decision_outcome: "Approved maintenance plan",
    observer_notes: "Prototype record only.",
    evidence: "observed",
  },
];

const requiredColumns = [
  "record_id", "site_id", "site_name", "latitude", "longitude", "water_source_distance_m",
  "observation_date", "participant_id", "gender", "role", "attendance", "participation_level",
  "decision_influence", "decision_authority",
];

function normalizeRecord(input: Record<string, unknown>, index: number): FieldRecord {
  const num = (key: string) => Number(input[key]);
  const text = (key: string) => String(input[key] ?? "");
  const bool = (value: unknown) => value === true || value === "true" || value === "1" || value === 1;
  const participation = text("participation_level") as ParticipationLevel;
  const evidence = (text("evidence") || "observed") as EvidenceKind;

  return {
    record_id: text("record_id") || `import-${index + 1}`,
    site_id: text("site_id"),
    site_name: text("site_name"),
    latitude: num("latitude"),
    longitude: num("longitude"),
    water_source_type: text("water_source_type"),
    water_source_distance_m: num("water_source_distance_m"),
    observation_date: text("observation_date"),
    participant_id: text("participant_id") || `participant-${index + 1}`,
    gender: text("gender"),
    role: text("role"),
    attendance: bool(input.attendance),
    participation_level: ["attended", "participated", "influenced", "decided"].includes(participation) ? participation : "attended",
    decision_influence: Math.max(0, Math.min(1, num("decision_influence") || 0)),
    decision_authority: Math.max(0, Math.min(1, num("decision_authority") || 0)),
    decision_outcome: text("decision_outcome"),
    observer_notes: text("observer_notes"),
    evidence: ["observed", "reconstructed", "inferred", "verified"].includes(evidence) ? evidence : "observed",
  };
}

function parseCsv(text: string): Record<string, string>[] {
  const rows = text.trim().split(/\r?\n/).filter(Boolean);
  if (!rows.length) return [];
  const parseLine = (line: string) => {
    const values: string[] = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') { value += '"'; i += 1; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (char === "," && !quoted) { values.push(value.trim()); value = ""; continue; }
      value += char;
    }
    values.push(value.trim());
    return values;
  };
  const headers = parseLine(rows[0]);
  return rows.slice(1).map(row => {
    const values = parseLine(row);
    return Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]));
  });
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function metric(records: FieldRecord[], selector: (record: FieldRecord) => boolean) {
  if (!records.length) return 0;
  return Math.round((records.filter(selector).length / records.length) * 100);
}

export default function AquaGov() {
  const [records, setRecords] = useState<FieldRecord[]>(demoRecords);
  const [selectedSite, setSelectedSite] = useState("SHO-001");
  const [message, setMessage] = useState("Demo data loaded — replace it with a verified field import.");

  const sites = useMemo(() => Array.from(new Map(records.map(record => [record.site_id, record])).values()), [records]);
  const selectedRecords = records.filter(record => record.site_id === selectedSite);
  const women = selectedRecords.filter(record => record.gender.toLowerCase() === "woman" || record.gender.toLowerCase() === "female");
  const men = selectedRecords.filter(record => record.gender.toLowerCase() === "man" || record.gender.toLowerCase() === "male");
  const averageDistance = selectedRecords.length ? Math.round(selectedRecords.reduce((sum, r) => sum + r.water_source_distance_m, 0) / selectedRecords.length) : 0;
  const womenInfluence = women.length ? Math.round(women.reduce((sum, r) => sum + r.decision_influence, 0) / women.length * 100) : 0;
  const menInfluence = men.length ? Math.round(men.reduce((sum, r) => sum + r.decision_influence, 0) / men.length * 100) : 0;

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const raw = file.name.toLowerCase().endsWith(".json") ? JSON.parse(text) : parseCsv(text);
      const rows = Array.isArray(raw) ? raw : raw.records;
      if (!Array.isArray(rows) || !rows.length) throw new Error("No records found.");
      const first = rows[0] as Record<string, unknown>;
      const missing = requiredColumns.filter(column => !(column in first));
      if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);
      const imported = rows.map((row, index) => normalizeRecord(row, index));
      setRecords(imported);
      setSelectedSite(imported[0].site_id);
      setMessage(`Imported ${imported.length} field records from ${file.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    }
  };

  const exportGeoJson = () => {
    const geojson = {
      type: "FeatureCollection",
      features: sites.map(site => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [site.longitude, site.latitude] },
        properties: {
          site_id: site.site_id,
          site_name: site.site_name,
          record_count: records.filter(r => r.site_id === site.site_id).length,
          water_source_distance_m: site.water_source_distance_m,
          evidence_state: "field-record",
        },
      })),
    };
    download("aquagov-sites.geojson", JSON.stringify(geojson, null, 2), "application/geo+json");
  };

  return (
    <div className="min-h-screen bg-[#F2F0EA] text-[#1C2321]">
      <header className="border-b border-[#1C2321]/10 bg-[#F2F0EA]/95 px-6 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#2C6E6B]"><Waves size={15} /> AquaGov</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Field governance workspace</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#1C2321]/65">Spatial field records for water governance research. Demo data is explicitly labeled until verified records are imported.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[#2C6E6B]/25 bg-white/60 px-3 py-2 text-xs font-medium md:flex"><ShieldCheck size={14} /> Evidence-aware</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#A6532E]/20 bg-white/60 p-3 text-sm">
          <span>{message}</span>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#2C6E6B] px-3 py-2 text-xs font-semibold text-white"><Upload size={14} /> Import CSV/JSON<input className="hidden" type="file" accept=".csv,.json,application/json,text/csv" onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} /></label>
            <button onClick={() => download("aquagov-records.json", JSON.stringify(records, null, 2), "application/json")} className="inline-flex items-center gap-2 rounded-lg border border-[#1C2321]/15 bg-white px-3 py-2 text-xs font-semibold"><FileJson size={14} /> Export JSON</button>
            <button onClick={() => download("aquagov-records.csv", [Object.keys(records[0]).join(","), ...records.map(r => Object.values(r).map(v => `"${String(v).replaceAll('"', '""')}"`).join(","))].join("\n"), "text/csv")} className="inline-flex items-center gap-2 rounded-lg border border-[#1C2321]/15 bg-white px-3 py-2 text-xs font-semibold"><FileText size={14} /> Export CSV</button>
            <button onClick={exportGeoJson} className="inline-flex items-center gap-2 rounded-lg border border-[#1C2321]/15 bg-white px-3 py-2 text-xs font-semibold"><MapPinned size={14} /> GeoJSON layer</button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section className="relative min-h-[620px] overflow-hidden rounded-2xl border border-[#1C2321]/10 bg-[#dfe7df] shadow-sm">
            <div className="absolute inset-0 opacity-35" style={{ backgroundImage: "repeating-radial-gradient(ellipse at 20% 60%, transparent 0 48px, rgba(44,110,107,.22) 49px 50px)" }} />
            <div className="absolute left-5 top-5 z-10 rounded-xl bg-[#F2F0EA]/90 p-3 shadow-sm backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2C6E6B]">Spatial layer</div>
              <div className="mt-1 text-sm font-medium">Shai-Osudoku research workspace</div>
              <div className="mt-1 text-xs text-[#1C2321]/60">GeoJSON-ready • GeoLibre handoff</div>
            </div>
            {sites.map((site, index) => {
              const active = site.site_id === selectedSite;
              return <button key={site.site_id} onClick={() => setSelectedSite(site.site_id)} className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition ${active ? "border-[#2C6E6B] bg-[#2C6E6B] text-white" : "border-white bg-white/90 text-[#1C2321]"}`} style={{ left: `${24 + index * 25}%`, top: `${58 - index * 15}%` }}><span className="h-2 w-2 rounded-full bg-[#A6532E]" />{site.site_id}</button>;
            })}
            <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-[#1C2321]/10 bg-[#F2F0EA]/90 p-4 text-xs backdrop-blur">
              <strong>3D layer:</strong> awaiting a verified Gaussian Splat asset. The current layer contains field coordinates only; no reconstructed geometry is represented as observed evidence.
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border border-[#1C2321]/10 bg-white/75 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2C6E6B]">Selected site</div><h2 className="mt-1 text-xl font-semibold">{sites.find(s => s.site_id === selectedSite)?.site_name || selectedSite}</h2></div><span className="rounded-full bg-[#D4A03C]/15 px-2.5 py-1 text-xs font-semibold text-[#7c5b16]">DEMO / IMPORTABLE</span></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-[#F2F0EA] p-3"><span className="text-xs opacity-60">Records</span><div className="mt-1 text-lg font-semibold">{selectedRecords.length}</div></div><div className="rounded-lg bg-[#F2F0EA] p-3"><span className="text-xs opacity-60">Water distance</span><div className="mt-1 text-lg font-semibold">{averageDistance} m</div></div></div>
            </div>

            <div className="rounded-2xl border border-[#1C2321]/10 bg-white/75 p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2C6E6B]">Decision network</div>
              <div className="mt-4 space-y-3">
                {[
                  ["Attended", metric(selectedRecords, r => r.attendance)],
                  ["Participated", metric(selectedRecords, r => r.participation_level !== "attended")],
                  ["Influenced", metric(selectedRecords, r => ["influenced", "decided"].includes(r.participation_level))],
                  ["Decision authority", metric(selectedRecords, r => r.decision_authority >= 0.5)],
                ].map(([label, value]) => <div key={String(label)}><div className="mb-1 flex justify-between text-xs"><span>{label}</span><strong>{value}%</strong></div><div className="h-2 rounded-full bg-[#1C2321]/8"><div className="h-2 rounded-full bg-[#2C6E6B]" style={{ width: `${value}%` }} /></div></div>)}
              </div>
            </div>

            <div className="rounded-2xl border border-[#A6532E]/20 bg-white/75 p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A6532E]">Preliminary pattern</div>
              <p className="mt-2 text-sm leading-6">Current sample: <strong>{selectedRecords.length}</strong> records at an average source distance of <strong>{averageDistance} m</strong>. The observed gender decision-influence gap is <strong>{Math.abs(menInfluence - womenInfluence)} points</strong>.</p>
              <p className="mt-2 text-xs text-[#1C2321]/55">This is descriptive only. It does not establish causation and should not be treated as a research finding until verified field data and an appropriate statistical design are applied.</p>
            </div>
          </section>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#1C2321]/10 bg-white/75 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#1C2321]/10 px-5 py-4"><div><h2 className="font-semibold">Evidence & asset registry</h2><p className="text-xs text-[#1C2321]/55">The contract between field observations, GIS layers and future splat assets.</p></div><span className="font-mono text-xs text-[#2C6E6B]">AQUAGOV.v1</span></div>
          <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-[#F2F0EA]"><tr>{["Record", "Site", "Participant", "Role", "Participation", "Influence", "Authority", "Evidence"].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead><tbody>{records.map(record => <tr key={record.record_id} className="border-t border-[#1C2321]/8"><td className="px-4 py-3 font-mono">{record.record_id}</td><td className="px-4 py-3">{record.site_id}</td><td className="px-4 py-3">{record.gender}</td><td className="px-4 py-3">{record.role}</td><td className="px-4 py-3 capitalize">{record.participation_level}</td><td className="px-4 py-3">{Math.round(record.decision_influence * 100)}%</td><td className="px-4 py-3">{Math.round(record.decision_authority * 100)}%</td><td className="px-4 py-3"><span className="rounded-full bg-[#2C6E6B]/10 px-2 py-1 capitalize text-[#2C6E6B]">{record.evidence}</span></td></tr>)}</tbody></table></div>
        </section>
      </main>
    </div>
  );
}
