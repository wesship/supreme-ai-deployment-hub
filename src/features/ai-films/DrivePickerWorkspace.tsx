import { useMemo, useState } from 'react';
import { CheckCircle2, Cloud, FolderOpen, Play, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.d3vonn.io';
const GOOGLE_PICKER_SCRIPT_ID = 'd3vonn-google-picker-api';

interface ExpectedDriveFile {
  source_id: string;
  filename: string;
}

interface PickerSession {
  connection_id: string;
  account?: string | null;
  access_token: string;
  expires_in?: number | null;
  app_id?: string | null;
  developer_key?: string | null;
  expected_files: ExpectedDriveFile[];
  expected_count: number;
  selected_ids: string[];
  selected_count: number;
  selection_ready: boolean;
}

interface PickerSelectionResult {
  status: 'partial' | 'selected';
  selected_count: number;
  expected_count: number;
  selection_ready: boolean;
  missing_files: string[];
}

interface ManualRunResult {
  status: 'started' | 'already_running';
  tasks: string[];
}

type PickerNamespace = {
  Action: { PICKED: string; CANCEL: string };
  Document: { ID: string };
  Feature: { MULTISELECT_ENABLED: string };
  Response: { ACTION: string; DOCUMENTS: string };
  ViewId: { DOCS: string };
  DocsView: new (viewId?: string) => { setMimeTypes: (types: string) => unknown };
  PickerBuilder: new () => {
    addView: (view: unknown) => unknown;
    enableFeature: (feature: string) => unknown;
    setOAuthToken: (token: string) => unknown;
    setDeveloperKey: (key: string) => unknown;
    setAppId: (appId: string) => unknown;
    setCallback: (callback: (data: Record<string, unknown>) => void) => unknown;
    build: () => { setVisible: (visible: boolean) => void };
  };
};

declare global {
  interface Window {
    gapi?: {
      load: (
        api: string,
        options: { callback: () => void; onerror?: () => void; timeout?: number; ontimeout?: () => void },
      ) => void;
    };
    google?: { picker?: PickerNamespace };
  }
}

async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in with an admin account to use the Drive Picker.');

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload?.detail === 'string' ? payload.detail : `Drive Picker request failed (${response.status})`;
    throw new Error(detail);
  }
  return payload as T;
}

function loadGooglePicker(): Promise<PickerNamespace> {
  if (window.google?.picker) return Promise.resolve(window.google.picker);

  return new Promise((resolve, reject) => {
    const finish = () => {
      if (!window.gapi) {
        reject(new Error('Google Picker loader did not initialize.'));
        return;
      }
      window.gapi.load('picker', {
        callback: () => window.google?.picker
          ? resolve(window.google.picker)
          : reject(new Error('Google Picker API is unavailable.')),
        onerror: () => reject(new Error('Google Picker API failed to load.')),
        timeout: 15000,
        ontimeout: () => reject(new Error('Google Picker API timed out.')),
      });
    };

    const existing = document.getElementById(GOOGLE_PICKER_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.gapi) finish();
      else existing.addEventListener('load', finish, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_PICKER_SCRIPT_ID;
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => reject(new Error('Google Picker script could not be loaded.')), { once: true });
    document.head.appendChild(script);
  });
}

export default function DrivePickerWorkspace() {
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<PickerSession | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionReady, setSelectionReady] = useState(false);
  const [message, setMessage] = useState(
    'Automatic Sovereign Signal ingestion is paused. Use the admin-only Google Picker to authorize the 23 private Drive masters, then start ingestion explicitly.',
  );

  const expectedFiles = session?.expected_files || [];
  const missingFiles = useMemo(
    () => expectedFiles.filter((file) => !selectedIds.has(file.source_id)),
    [expectedFiles, selectedIds],
  );

  const recordSelection = async (ids: string[]) => {
    const result = await adminApi<PickerSelectionResult>('/api/ai-films/admin/drive-picker/selection', {
      method: 'POST',
      body: JSON.stringify({ source_ids: ids }),
    });
    setSelectedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setSelectionReady(result.selection_ready);
    setMessage(result.selection_ready
      ? `All ${result.expected_count} Sovereign Signal Drive masters are Picker-authorized. Ingestion can now be started explicitly.`
      : `${result.selected_count}/${result.expected_count} masters selected. Reopen the Picker and select the remaining files.`);
  };

  const openPicker = async () => {
    setBusy(true);
    try {
      const pickerSession = await adminApi<PickerSession>('/api/ai-films/admin/drive-picker/session');
      setSession(pickerSession);
      setSelectedIds(new Set(pickerSession.selected_ids));
      setSelectionReady(pickerSession.selection_ready);
      const picker = await loadGooglePicker();
      const view = new picker.DocsView(picker.ViewId.DOCS);
      view.setMimeTypes('video/mp4');

      const builder = new picker.PickerBuilder();
      builder.addView(view);
      builder.enableFeature(picker.Feature.MULTISELECT_ENABLED);
      builder.setOAuthToken(pickerSession.access_token);
      if (pickerSession.developer_key) builder.setDeveloperKey(pickerSession.developer_key);
      if (pickerSession.app_id) builder.setAppId(pickerSession.app_id);
      builder.setCallback((data) => {
        const action = data[picker.Response.ACTION];
        if (action === picker.Action.PICKED) {
          const documents = Array.isArray(data[picker.Response.DOCUMENTS])
            ? data[picker.Response.DOCUMENTS] as Array<Record<string, unknown>>
            : [];
          const ids = documents
            .map((document) => String(document[picker.Document.ID] || ''))
            .filter(Boolean);
          if (ids.length > 0) {
            setBusy(true);
            void recordSelection(ids)
              .catch((error) => setMessage(error instanceof Error ? error.message : 'Drive selection could not be recorded.'))
              .finally(() => setBusy(false));
          }
        } else if (action === picker.Action.CANCEL) {
          setMessage('Drive Picker closed without changing the saved selection.');
        }
      });
      builder.build().setVisible(true);
      setMessage(
        pickerSession.selection_ready
          ? `All ${pickerSession.expected_count} masters are already selected. You can start ingestion or reopen the Picker to review.`
          : `Select the Sovereign Signal video masters from ${pickerSession.account || 'the connected Drive account'}. Multi-select is enabled.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Google Drive Picker could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  const runIngestion = async () => {
    setBusy(true);
    try {
      const result = await adminApi<ManualRunResult>('/api/ai-films/admin/drive-picker/run', { method: 'POST' });
      setMessage(result.status === 'already_running'
        ? `Ingestion is already running: ${result.tasks.join(', ')}.`
        : `Ingestion started: ${result.tasks.join(', ')}. Provider IDs and completion state will be written back to the Knowledge Core.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sovereign Signal ingestion could not be started.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-cyan-500/30 p-5 sm:p-6" aria-labelledby="drive-picker-heading">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Private Drive authorization</Badge>
            <Badge variant="outline">Admin only</Badge>
            {selectionReady && <Badge className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Selection complete</Badge>}
          </div>
          <h2 id="drive-picker-heading" className="mt-3 text-2xl font-bold">Sovereign Signal · Google Drive Picker</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Authorize the production masters through Google Picker without making any Drive file public. The short-lived picker token stays in this browser session and is never written to Supabase.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void openPicker()} disabled={busy}>
            <FolderOpen className="mr-2 h-4 w-4" />Open Google Picker
          </Button>
          <Button type="button" onClick={() => void runIngestion()} disabled={busy || !selectionReady}>
            <Play className="mr-2 h-4 w-4" />Start ingestion
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 p-4">
          <Cloud className="h-5 w-5 text-primary" />
          <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Connected account</p>
          <p className="mt-1 font-semibold">{session?.account || 'Loaded when Picker opens'}</p>
        </div>
        <div className="rounded-xl border border-border/70 p-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Selected masters</p>
          <p className="mt-1 font-semibold">{selectedIds.size}/{session?.expected_count ?? 23}</p>
        </div>
        <div className="rounded-xl border border-border/70 p-4">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Automatic retry</p>
          <p className="mt-1 font-semibold">Paused · explicit start only</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm" role="status" aria-live="polite">{message}</div>

      {expectedFiles.length > 0 && (
        <details className="mt-4 rounded-xl border border-border/70 p-4">
          <summary className="cursor-pointer font-semibold">
            {missingFiles.length === 0 ? 'All expected masters selected' : `${missingFiles.length} masters still need selection`}
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {expectedFiles.map((file) => {
              const selected = selectedIds.has(file.source_id);
              return (
                <div key={file.source_id} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs">
                  <CheckCircle2 className={`h-4 w-4 shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground/40'}`} />
                  <span className={selected ? 'font-medium' : 'text-muted-foreground'}>{file.filename}</span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </Card>
  );
}
