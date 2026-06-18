import { useEffect, useMemo, useState } from "react";
import { Upload, FileAudio, Loader2, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { speechApi, SpeechHealthResponse, SpeechTranscriptionResponse } from "../api/speech/speechApi";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";

const models = [
  { value: "openai/whisper-large-v3", label: "Whisper Large V3 — highest accuracy" },
  { value: "distil-whisper/distil-medium.en", label: "Distil-Whisper Medium EN — faster draft" },
];

export default function SpeechIntelligence() {
  const [health, setHealth] = useState<SpeechHealthResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState(models[0].value);
  const [language, setLanguage] = useState("english");
  const [includeGraph, setIncludeGraph] = useState(true);
  const [saveToCrm, setSaveToCrm] = useState(false);
  const [crmContactId, setCrmContactId] = useState("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpeechTranscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    speechApi.health()
      .then(setHealth)
      .catch((err) => setHealth({ configured: false, service_url: "", status: err?.message ?? "unreachable" }));
  }, []);

  const canSubmit = useMemo(() => Boolean(file) && !loading, [file, loading]);

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);

    try {
      const response = await speechApi.transcribe(
        file,
        {
          model,
          language: language.trim() || undefined,
          includeGraph,
          saveToCrm,
          crmContactId: crmContactId.trim() || undefined,
        },
        setProgress,
      );
      setResult(response);
      toast.success("Speech intelligence completed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transcription failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function copyTranscript() {
    if (!result?.transcript) return;
    navigator.clipboard.writeText(result.transcript);
    toast.success("Transcript copied");
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Devonn.AI Intelligence Layer</p>
          <h1 className="mt-2 text-3xl font-bold md:text-5xl">Speech Intelligence</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Upload audio or video, transcribe it with Whisper, then convert the transcript into summaries,
            topics, action items, timestamped notes, and concept graph output for CRM, training, and content workflows.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {health?.status === "ok" ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              Service status: {health?.status ?? "checking"}
            </CardTitle>
            <CardDescription>
              Backend proxy target: {health?.service_url || "SPEECH_INTELLIGENCE_BASE_URL not configured"}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileAudio className="h-5 w-5" /> Upload media</CardTitle>
              <CardDescription>Supported: WAV, MP3, M4A, WebM, MOV, and MP4.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="speech-file">Audio or video file</Label>
                <Input
                  id="speech-file"
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {models.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language hint</Label>
                <Input id="language" value={language} onChange={(event) => setLanguage(event.target.value)} />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Generate concept graph</Label>
                  <p className="text-xs text-muted-foreground">Create nodes/edges for Devonn.AI knowledge mapping.</p>
                </div>
                <Switch checked={includeGraph} onCheckedChange={setIncludeGraph} />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Prepare CRM note</Label>
                  <p className="text-xs text-muted-foreground">Send CRM metadata downstream when a contact id is supplied.</p>
                </div>
                <Switch checked={saveToCrm} onCheckedChange={setSaveToCrm} />
              </div>

              {saveToCrm && (
                <div className="space-y-2">
                  <Label htmlFor="crm-contact">CRM contact id</Label>
                  <Input id="crm-contact" value={crmContactId} onChange={(event) => setCrmContactId(event.target.value)} />
                </div>
              )}

              <Button className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {loading ? `Processing${progress ? ` ${progress}%` : ""}` : "Transcribe and analyze"}
              </Button>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transcript</CardTitle>
                <CardDescription>{result ? `${result.filename} • ${result.model}` : "The cleaned transcript will appear here."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea value={result?.transcript ?? ""} readOnly className="min-h-[240px]" placeholder="No transcript yet." />
                <Button variant="outline" onClick={copyTranscript} disabled={!result?.transcript}>
                  <Copy className="mr-2 h-4 w-4" /> Copy transcript
                </Button>
              </CardContent>
            </Card>

            {result && (
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{result.summary || "No summary returned."}</p></CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Action items</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                      {(result.action_items?.length ? result.action_items : ["No action items returned."]).map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Topics</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {(result.topics?.length ? result.topics : ["No topics returned."]).map((topic) => (
                      <span key={topic} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{topic}</span>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Timestamp chunks</CardTitle></CardHeader>
                  <CardContent className="max-h-72 overflow-auto space-y-3 text-sm text-muted-foreground">
                    {result.chunks?.map((chunk, index) => (
                      <div key={`${chunk.start}-${index}`} className="rounded-lg border p-3">
                        <p className="font-mono text-xs">{chunk.start.toFixed(2)}s → {chunk.end.toFixed(2)}s</p>
                        <p className="mt-1">{chunk.text}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
