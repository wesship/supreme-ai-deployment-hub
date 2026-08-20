import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

type Json = Record<string, unknown>;
type ProviderProfile = {
  provider_key: string;
  display_name: string;
  adapter_key: string;
  default_model: string;
  default_model_version: string | null;
  license_name: string;
  license_source_url: string | null;
  license_review_status: string;
  commercial_allowed: boolean;
  hosted_allowed: boolean;
  output_commercial_allowed: boolean;
  attribution_requirements: unknown;
  provenance_requirements: unknown;
};
type MusicJob = {
  id: string;
  user_id: string;
  provider_key: string;
  provider_task_id: string | null;
  provider_display_name: string;
  model_name: string;
  model_version: string | null;
  status: string;
  prompt: string;
  lyrics: string;
  parameters: Json;
  original_audio_path: string | null;
  processed_audio_path: string | null;
  audio_url: string | null;
  attempt_count: number;
  max_attempts: number;
};
type ProviderResult = {
  state: "running" | "succeeded" | "failed";
  failureReason?: string;
  audioPath?: string;
  metadata?: Json;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key, x-music-ops-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ACTIVE_STATUSES = ["queued", "provisioning", "running", "post_processing", "uploading", "retrying"];
const TERMINAL_STATUSES = ["succeeded", "failed", "cancelled"];
const MAX_CONCURRENT_JOBS = 2;
const MAX_MONTHLY_JOBS = 100;
const MAX_AUDIO_BYTES = 32 * 1024 * 1024;

const env = (name: string) => Deno.env.get(name) ?? "";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const userClient = (req: Request) =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
const adminClient = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const isoMonthStart = () => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
const publicError = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const clampNumber = (value: unknown, minimum: number, maximum: number, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(minimum, numeric)) : fallback;
};
const trimText = (value: unknown, maximum: number) => String(value ?? "").trim().slice(0, maximum);
const normalizeTitle = (value: unknown, prompt: string) => trimText(value, 160) || prompt.slice(0, 80) || "Untitled generation";
const elapsedMs = (startedAt: number) => Math.max(0, Date.now() - startedAt);

async function fingerprint(value: Json) {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
}

function aceStepBaseUrl() {
  const base = env("ACESTEP_API_URL").replace(/\/$/, "");
  if (!base) throw new Error("ACESTEP_API_URL is not configured");
  return base;
}

async function aceStepRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const key = env("ACESTEP_API_KEY");
  if (key) headers.set("Authorization", `Bearer ${key}`);
  const response = await fetch(`${aceStepBaseUrl()}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`ACE-Step API returned HTTP ${response.status}`);
  return await response.json();
}

function parseProviderResult(raw: unknown): Json | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return parseProviderResult(JSON.parse(raw)); } catch { return null; }
  }
  if (Array.isArray(raw)) return parseProviderResult(raw[0]);
  return typeof raw === "object" ? raw as Json : null;
}

function absoluteProviderAudioUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : `${aceStepBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

async function submitToProvider(profile: ProviderProfile, request: Json) {
  if (profile.adapter_key !== "ace_step_async") throw new Error(`Unsupported music adapter: ${profile.adapter_key}`);
  const startedAt = Date.now();
  const task = await aceStepRequest("/release_task", {
    method: "POST",
    body: JSON.stringify({
      prompt: request.prompt,
      lyrics: request.instrumental ? "" : request.lyrics,
      bpm: request.bpm,
      audio_duration: request.duration_seconds,
      vocal_language: request.vocal_language,
      audio_format: "mp3",
      model: profile.default_model,
      thinking: true,
      use_random_seed: request.seed === null,
      seed: request.seed ?? -1,
    }),
  });
  const payload = (task?.data ?? task) as Json;
  const taskId = String(payload.task_id ?? "").trim();
  if (!taskId) throw new Error("Music provider did not return a task ID");
  return { taskId, latencyMs: elapsedMs(startedAt) };
}

async function queryProvider(profile: ProviderProfile, job: MusicJob): Promise<ProviderResult> {
  if (!job.provider_task_id) throw new Error("Music job is missing its provider task ID");
  if (profile.adapter_key !== "ace_step_async") throw new Error(`Unsupported music adapter: ${profile.adapter_key}`);
  const response = await aceStepRequest("/query_result", {
    method: "POST",
    body: JSON.stringify({ task_id_list: [job.provider_task_id] }),
  });
  const task = response?.data?.[0] ?? response?.[0];
  if (task?.status === 2) return { state: "failed", failureReason: String(task.error ?? "Provider generation failed") };
  if (task?.status !== 1) return { state: "running" };
  const result = parseProviderResult(task?.result ?? response?.data?.result ?? response?.result);
  const audioPath = trimText(result?.file ?? result?.audio_url ?? result?.audio, 4000);
  if (!audioPath) return { state: "failed", failureReason: "Provider completed without an audio file" };
  return { state: "succeeded", audioPath, metadata: result ?? {} };
}

function providerDispatchAllowed(profile: ProviderProfile) {
  return profile.license_review_status === "approved" && profile.commercial_allowed && profile.hosted_allowed && profile.output_commercial_allowed;
}

async function approvedProvider(preferredProvider?: string) {
  const admin = adminClient();
  let query = admin
    .from("music_provider_profiles")
    .select("provider_key, display_name, adapter_key, default_model, default_model_version, license_name, license_source_url, license_review_status, commercial_allowed, hosted_allowed, output_commercial_allowed, attribution_requirements, provenance_requirements")
    .eq("enabled", true)
    .eq("license_review_status", "approved")
    .eq("commercial_allowed", true)
    .eq("hosted_allowed", true)
    .eq("output_commercial_allowed", true)
    .order("priority", { ascending: true })
    .limit(1);
  if (preferredProvider) query = query.eq("provider_key", preferredProvider);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as ProviderProfile | null;
}

async function providerForJob(job: MusicJob) {
  const { data, error } = await adminClient()
    .from("music_provider_profiles")
    .select("provider_key, display_name, adapter_key, default_model, default_model_version, license_name, license_source_url, license_review_status, commercial_allowed, hosted_allowed, output_commercial_allowed, attribution_requirements, provenance_requirements")
    .eq("provider_key", job.provider_key)
    .single();
  if (error) throw error;
  return data as ProviderProfile;
}

async function logSafetyEvent(userId: string, eventType: string, reason: string, metadata: Json, jobId?: string) {
  await adminClient().from("music_safety_events").insert({
    user_id: userId,
    job_id: jobId ?? null,
    event_type: eventType,
    reason,
    metadata,
  });
}

async function logJobEvent(job: MusicJob, eventType: string, message: string, metadata: Json = {}) {
  await adminClient().from("music_job_events").insert({
    job_id: job.id,
    user_id: job.user_id,
    event_type: eventType,
    message,
    metadata,
  });
}

async function getOwnedJob(userId: string, jobId: string) {
  const { data, error } = await adminClient().from("music_generation_jobs").select("*").eq("id", jobId).eq("user_id", userId).single();
  if (error || !data) return null;
  return data as MusicJob;
}

async function recordProviderHealth(profile: ProviderProfile, status: "healthy" | "degraded" | "offline" | "unknown", details: Json, signals: Json = {}) {
  await adminClient().from("music_provider_health_snapshots").insert({
    provider_key: profile.provider_key,
    status,
    gpu_online: typeof signals.gpu_online === "boolean" ? signals.gpu_online : null,
    gpu_name: typeof signals.gpu_name === "string" ? signals.gpu_name : null,
    vram_total_mb: typeof signals.vram_total_mb === "number" ? signals.vram_total_mb : null,
    vram_free_mb: typeof signals.vram_free_mb === "number" ? signals.vram_free_mb : null,
    model_loaded: typeof signals.model_loaded === "boolean" ? signals.model_loaded : null,
    api_latency_ms: typeof signals.api_latency_ms === "number" ? signals.api_latency_ms : null,
    queue_depth: typeof signals.queue_depth === "number" ? signals.queue_depth : null,
    supported_duration_seconds: typeof signals.supported_duration_seconds === "number" ? signals.supported_duration_seconds : null,
    provider_version: profile.default_model_version,
    last_successful_generation_at: typeof signals.last_successful_generation_at === "string" ? signals.last_successful_generation_at : null,
    details,
  });
  await adminClient().from("music_provider_profiles").update({ technical_status: status === "healthy" ? "healthy" : status }).eq("provider_key", profile.provider_key);
}

async function probeProvider(request: Request, body: Json) {
  if (!operationsAuthorized(request)) return json({ error: "Operations authorization required" }, 403);
  const providerKey = trimText(body.provider, 100);
  const { data: profile, error } = await adminClient().from("music_provider_profiles")
    .select("provider_key, display_name, adapter_key, default_model, default_model_version, license_name, license_source_url, license_review_status, commercial_allowed, hosted_allowed, output_commercial_allowed, attribution_requirements, provenance_requirements")
    .eq("provider_key", providerKey || "ace-step-1.5")
    .single();
  if (error || !profile) return json({ error: "Provider not found" }, 404);
  const typedProfile = profile as ProviderProfile;
  const startedAt = Date.now();
  try {
    if (typedProfile.adapter_key !== "ace_step_async") throw new Error(`Unsupported music adapter: ${typedProfile.adapter_key}`);
    const [healthPayload, statsPayload, modelsPayload] = await Promise.all([
      aceStepRequest("/health", { method: "GET" }),
      aceStepRequest("/v1/stats", { method: "GET" }),
      aceStepRequest("/v1/models", { method: "GET" }),
    ]);
    const healthData = (healthPayload?.data ?? healthPayload ?? {}) as Json;
    const stats = (statsPayload?.data ?? statsPayload ?? {}) as Json;
    const models = (modelsPayload?.data ?? modelsPayload ?? {}) as Json;
    const jobs = (stats.jobs ?? {}) as Json;
    const availableModels = Array.isArray(models.models) ? models.models : [];
    const gpu = (stats.gpu ?? healthData.gpu ?? {}) as Json;
    const signals: Json = {
      gpu_online: typeof gpu.online === "boolean" ? gpu.online : true,
      gpu_name: typeof gpu.name === "string" ? gpu.name : null,
      vram_total_mb: Number.isFinite(Number(gpu.vram_total_mb)) ? Number(gpu.vram_total_mb) : null,
      vram_free_mb: Number.isFinite(Number(gpu.vram_free_mb)) ? Number(gpu.vram_free_mb) : null,
      model_loaded: availableModels.length > 0,
      api_latency_ms: elapsedMs(startedAt),
      queue_depth: Number.isFinite(Number(stats.queue_size)) ? Number(stats.queue_size) : null,
      supported_duration_seconds: 600,
    };
    await recordProviderHealth(typedProfile, "healthy", { health: healthData, stats: { queue_size: stats.queue_size, queue_maxsize: stats.queue_maxsize, succeeded: jobs.succeeded, failed: jobs.failed }, models: availableModels }, signals);
    return json({ provider: typedProfile.provider_key, status: "healthy", signals });
  } catch (probeError) {
    const reason = publicError(probeError, "Provider health probe failed");
    await recordProviderHealth(typedProfile, "offline", { operation: "probe", error: reason }, { gpu_online: false, api_latency_ms: elapsedMs(startedAt), supported_duration_seconds: 600 });
    return json({ provider: typedProfile.provider_key, status: "offline", error: reason }, 502);
  }
}

async function validateQuota(userId: string, requestFingerprint: string) {
  const admin = adminClient();
  const { count: concurrentCount, error: concurrentError } = await admin
    .from("music_generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES);
  if (concurrentError) throw concurrentError;
  if ((concurrentCount ?? 0) >= MAX_CONCURRENT_JOBS) {
    await logSafetyEvent(userId, "concurrency_blocked", "Concurrent music-generation limit reached", { active_jobs: concurrentCount ?? 0, limit: MAX_CONCURRENT_JOBS, request_fingerprint: requestFingerprint });
    throw new Error(`You already have ${MAX_CONCURRENT_JOBS} active music jobs. Wait for one to finish before starting another.`);
  }
  const { count: monthlyCount, error: monthlyError } = await admin
    .from("music_generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", isoMonthStart());
  if (monthlyError) throw monthlyError;
  if ((monthlyCount ?? 0) >= MAX_MONTHLY_JOBS) {
    await logSafetyEvent(userId, "monthly_quota_blocked", "Monthly music-generation limit reached", { monthly_jobs: monthlyCount ?? 0, limit: MAX_MONTHLY_JOBS, request_fingerprint: requestFingerprint });
    throw new Error("Your monthly music-generation quota has been reached.");
  }
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("ogg") || contentType.includes("opus")) return "opus";
  if (contentType.includes("flac")) return "flac";
  if (contentType.includes("aac")) return "aac";
  return "mp3";
}

function base64ToBytes(value: string) {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

async function runAudioQa(sourceUrl: string, fallbackBytes: Uint8Array, fallbackContentType: string) {
  const qaUrl = env("MUSIC_AUDIO_QA_URL").replace(/\/$/, "");
  if (!qaUrl) {
    return {
      bytes: fallbackBytes,
      contentType: fallbackContentType,
      qaResult: { status: "basic_validation_only", reason: "MUSIC_AUDIO_QA_URL is not configured", size_bytes: fallbackBytes.byteLength },
      postProcessed: false,
    };
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = env("MUSIC_AUDIO_QA_TOKEN");
  if (token) headers["X-Music-QA-Token"] = token;
  const response = await fetch(qaUrl, { method: "POST", headers, body: JSON.stringify({ source_url: sourceUrl, target_lufs: -14, true_peak_dbtp: -1 }) });
  if (!response.ok) throw new Error(`Audio QA service returned HTTP ${response.status}`);
  const payload = await response.json();
  const audioBase64 = trimText(payload.audio_base64, MAX_AUDIO_BYTES * 2);
  if (!audioBase64) throw new Error("Audio QA service did not return mastered audio");
  const bytes = base64ToBytes(audioBase64);
  if (bytes.byteLength > MAX_AUDIO_BYTES) throw new Error("Mastered audio exceeds the configured storage limit");
  return {
    bytes,
    contentType: trimText(payload.content_type, 100) || fallbackContentType,
    qaResult: typeof payload.qa_result === "object" && payload.qa_result ? payload.qa_result as Json : { status: "unknown" },
    postProcessed: true,
  };
}

async function uploadCompletedAudio(job: MusicJob, profile: ProviderProfile, providerResult: ProviderResult) {
  if (!providerResult.audioPath) throw new Error("No provider audio path is available for upload");
  const providerHeaders = env("ACESTEP_API_KEY") ? { Authorization: `Bearer ${env("ACESTEP_API_KEY")}` } : undefined;
  const sourceResponse = await fetch(absoluteProviderAudioUrl(providerResult.audioPath), { headers: providerHeaders });
  if (!sourceResponse.ok) throw new Error(`Unable to download generated audio (HTTP ${sourceResponse.status})`);
  const originalBytes = new Uint8Array(await sourceResponse.arrayBuffer());
  if (originalBytes.byteLength === 0 || originalBytes.byteLength > MAX_AUDIO_BYTES) throw new Error("Generated audio is empty or exceeds the configured storage limit");
  const originalContentType = sourceResponse.headers.get("content-type") || "audio/mpeg";
  if (!originalContentType.startsWith("audio/")) throw new Error(`Unexpected generated asset type: ${originalContentType}`);
  const originalExtension = extensionFromContentType(originalContentType);
  const originalPath = `${job.user_id}/${job.id}/original.${originalExtension}`;
  const admin = adminClient();
  const originalUpload = await admin.storage.from("music-library").upload(originalPath, originalBytes, { contentType: originalContentType, upsert: true });
  if (originalUpload.error) throw originalUpload.error;
  const signedOriginal = await admin.storage.from("music-library").createSignedUrl(originalPath, 900);
  if (signedOriginal.error || !signedOriginal.data?.signedUrl) throw signedOriginal.error ?? new Error("Could not create signed URL for audio QA");

  const qa = await runAudioQa(signedOriginal.data.signedUrl, originalBytes, originalContentType);
  const processedPath = `${job.user_id}/${job.id}/mastered.${extensionFromContentType(qa.contentType)}`;
  const processedUpload = await admin.storage.from("music-library").upload(processedPath, qa.bytes, { contentType: qa.contentType, upsert: true });
  if (processedUpload.error) throw processedUpload.error;
  const signedProcessed = await admin.storage.from("music-library").createSignedUrl(processedPath, 60 * 60 * 24 * 7);
  if (signedProcessed.error || !signedProcessed.data?.signedUrl) throw signedProcessed.error ?? new Error("Could not create signed library URL");

  const metadata = providerResult.metadata ?? {};
  const seedValue = Number(metadata.seed_value ?? metadata.seed ?? NaN);
  const update = await admin.from("music_generation_jobs").update({
    status: "succeeded",
    original_audio_path: originalPath,
    processed_audio_path: processedPath,
    audio_url: signedProcessed.data.signedUrl,
    audio_bytes: qa.bytes.byteLength,
    seed: Number.isSafeInteger(seedValue) ? seedValue : null,
    audio_metadata: { source_content_type: originalContentType, processed_content_type: qa.contentType, provider_metadata: metadata },
    qa_result: qa.qaResult,
    provenance: {
      provider_key: profile.provider_key,
      provider_display_name: profile.display_name,
      provider_task_id: job.provider_task_id,
      model_name: job.model_name,
      model_version: job.model_version,
      original_audio_path: originalPath,
      processed_audio_path: processedPath,
      post_processed: qa.postProcessed,
      generated_at: new Date().toISOString(),
    },
    failure_reason: null,
    error_message: null,
  }).eq("id", job.id).select("*").single();
  if (update.error) throw update.error;
  return update.data as MusicJob;
}

async function submit(userId: string, request: Request, body: Json) {
  const prompt = trimText(body.prompt, 4000);
  if (prompt.length < 4) return json({ error: "Prompt must be between 4 and 4000 characters." }, 400);
  const lyrics = trimText(body.lyrics, 12000);
  const instrumental = Boolean(body.instrumental);
  const durationSeconds = Math.round(clampNumber(body.duration, 10, 600, 90));
  const bpm = Math.round(clampNumber(body.bpm, 40, 240, 120));
  const vocalLanguage = trimText(body.vocal_language, 16) || "en";
  const genre = trimText(body.genre, 240) || null;
  const keySignature = trimText(body.key_signature, 48) || null;
  const seedCandidate = Number(body.seed);
  const seed = Number.isSafeInteger(seedCandidate) && seedCandidate >= 0 ? seedCandidate : null;
  const requestParameters: Json = { prompt, lyrics: instrumental ? "" : lyrics, genre, bpm, duration_seconds: durationSeconds, vocal_language: vocalLanguage, instrumental, key_signature: keySignature, seed };
  const requestFingerprint = await fingerprint(requestParameters);
  const idempotencyKey = trimText(request.headers.get("x-idempotency-key") || body.idempotency_key, 200) || null;
  const admin = adminClient();

  if (idempotencyKey) {
    const existing = await admin.from("music_generation_jobs").select("*").eq("user_id", userId).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return json({ job: existing.data, idempotent: true });
  }

  const profile = await approvedProvider(trimText(body.provider, 100) || undefined);
  if (!profile) {
    await logSafetyEvent(userId, "provider_policy_blocked", "No hosted and commercial music provider has approved policy status", { requested_provider: trimText(body.provider, 100) || null, request_fingerprint: requestFingerprint });
    return json({ error: "Music generation is not yet enabled because no provider has passed the hosted and commercial policy gate. Demo tracks remain available while approval is completed." }, 409);
  }

  await validateQuota(userId, requestFingerprint);
  const { data: queuedJob, error: insertError } = await admin.from("music_generation_jobs").insert({
    user_id: userId,
    provider_key: profile.provider_key,
    provider_display_name: profile.display_name,
    model_name: profile.default_model,
    model_version: profile.default_model_version,
    title: normalizeTitle(body.title, prompt),
    prompt,
    lyrics: instrumental ? "" : lyrics,
    genre,
    bpm,
    key_signature: keySignature,
    duration_seconds: durationSeconds,
    vocal_language: vocalLanguage,
    instrumental,
    seed,
    parameters: requestParameters,
    idempotency_key: idempotencyKey,
    request_fingerprint: requestFingerprint,
    status: "queued",
    license_snapshot: {
      license_name: profile.license_name,
      license_source_url: profile.license_source_url,
      license_review_status: profile.license_review_status,
      commercial_allowed: profile.commercial_allowed,
      hosted_allowed: profile.hosted_allowed,
      output_commercial_allowed: profile.output_commercial_allowed,
      attribution_requirements: profile.attribution_requirements,
      provenance_requirements: profile.provenance_requirements,
    },
  }).select("*").single();
  if (insertError || !queuedJob) throw insertError ?? new Error("Could not create music job");
  const job = queuedJob as MusicJob;
  await logJobEvent(job, "queued_for_dispatch", "Music job is queued for the server-side provider worker.", { request_fingerprint: requestFingerprint });
  return json({ job });
}

async function reconcileRunningJob(job: MusicJob): Promise<MusicJob> {
  const profile = await providerForJob(job);
  try {
    const providerResult = await queryProvider(profile, job);
    if (providerResult.state === "running") return job;
    if (providerResult.state === "failed") {
      const { data: failed, error } = await adminClient().from("music_generation_jobs").update({ status: "failed", failure_reason: "provider_generation_failed", error_message: providerResult.failureReason ?? "Provider generation failed" }).eq("id", job.id).select("*").single();
      if (error || !failed) throw error ?? new Error("Could not record provider failure");
      await recordProviderHealth(profile, "degraded", { operation: "query", failure_reason: providerResult.failureReason ?? "Provider generation failed" });
      return failed as MusicJob;
    }
    const postProcessing = await adminClient().from("music_generation_jobs").update({ status: "post_processing" }).eq("id", job.id).select("*").single();
    if (postProcessing.error || !postProcessing.data) throw postProcessing.error ?? new Error("Could not begin audio post-processing");
    const uploading = await adminClient().from("music_generation_jobs").update({ status: "uploading" }).eq("id", job.id).select("*").single();
    if (uploading.error || !uploading.data) throw uploading.error ?? new Error("Could not begin library upload");
    const completed = await uploadCompletedAudio(uploading.data as MusicJob, profile, providerResult);
    await logJobEvent(completed, "library_registered", "Generated audio was validated and saved to the private music library.", { original_audio_path: completed.original_audio_path, processed_audio_path: completed.processed_audio_path });
    await recordProviderHealth(profile, "healthy", { operation: "query_and_store", last_successful_generation_at: new Date().toISOString() });
    return completed;
  } catch (error) {
    const reason = publicError(error, "Music generation status check failed");
    const current = await getOwnedJob(job.user_id, job.id);
    if (!current || TERMINAL_STATUSES.includes(current.status)) return current ?? job;
    const { data: failed, error: failureError } = await adminClient().from("music_generation_jobs").update({ status: "failed", failure_reason: "post_processing_or_upload_failed", error_message: reason }).eq("id", job.id).select("*").single();
    if (failureError || !failed) throw failureError ?? new Error("Could not record music job failure");
    await logSafetyEvent(job.user_id, "post_processing_or_upload_failed", reason, { provider_key: job.provider_key }, job.id);
    await recordProviderHealth(profile, "degraded", { operation: "query_and_store", error: reason });
    return failed as MusicJob;
  }
}

async function checkStatus(userId: string, body: Json) {
  const jobId = trimText(body.job_id, 100);
  if (!jobId) return json({ error: "job_id is required" }, 400);
  const job = await getOwnedJob(userId, jobId);
  if (!job) return json({ error: "Job not found" }, 404);
  return json({ job });
}

function operationsAuthorized(request: Request) {
  const expectedToken = env("MUSIC_OPS_TOKEN");
  return Boolean(expectedToken) && request.headers.get("X-Music-Ops-Token") === expectedToken;
}

async function dispatchCycle(request: Request, body: Json) {
  if (!operationsAuthorized(request)) return json({ error: "Operations authorization required" }, 403);
  const limit = Math.round(clampNumber(body.limit, 1, 25, 5));
  const admin = adminClient();
  const { data: claimed, error: claimError } = await admin.rpc("music_claim_generation_jobs", { p_limit: limit });
  if (claimError) throw claimError;
  const outcomes: Json[] = [];
  for (const rawJob of (claimed ?? [])) {
    const job = rawJob as MusicJob;
    try {
      const profile = await providerForJob(job);
      if (!providerDispatchAllowed(profile)) throw new Error("Provider policy approval was revoked before dispatch");
      const parameters = job.parameters as Json;
      const providerSubmission = await submitToProvider(profile, parameters);
      const { data: updated, error } = await admin.from("music_generation_jobs").update({
        status: "running",
        provider_task_id: providerSubmission.taskId,
        last_provider_latency_ms: providerSubmission.latencyMs,
      }).eq("id", job.id).select("*").single();
      if (error || !updated) throw error ?? new Error("Could not start music job");
      await logJobEvent(updated as MusicJob, "provider_submitted", "Music generation was accepted by the provider.", { provider_task_id: providerSubmission.taskId, latency_ms: providerSubmission.latencyMs });
      await recordProviderHealth(profile, "healthy", { operation: "submit", latency_ms: providerSubmission.latencyMs }, { api_latency_ms: providerSubmission.latencyMs, supported_duration_seconds: 600 });
      outcomes.push({ job_id: job.id, status: "running" });
    } catch (dispatchError) {
      const reason = publicError(dispatchError, "Music generation submission failed");
      const { data: failed, error: failError } = await admin.from("music_generation_jobs").update({ status: "failed", failure_reason: "submission_error", error_message: reason }).eq("id", job.id).select("*").single();
      if (failError || !failed) throw failError ?? new Error("Could not record provider submission failure");
      await logSafetyEvent(job.user_id, "provider_submission_failed", reason, { provider_key: job.provider_key }, job.id);
      outcomes.push({ job_id: job.id, status: "failed", error: reason });
    }
  }
  const { data: running, error: runningError } = await admin.from("music_generation_jobs").select("*").eq("status", "running").order("started_at", { ascending: true }).limit(limit * 4);
  if (runningError) throw runningError;
  for (const rawJob of (running ?? [])) {
    const reconciled = await reconcileRunningJob(rawJob as MusicJob);
    outcomes.push({ job_id: reconciled.id, status: reconciled.status });
  }
  return json({ claimed: (claimed ?? []).length, reconciled: (running ?? []).length, outcomes });
}

async function cancel(userId: string, body: Json) {
  const jobId = trimText(body.job_id, 100);
  const job = await getOwnedJob(userId, jobId);
  if (!job) return json({ error: "Job not found" }, 404);
  if (TERMINAL_STATUSES.includes(job.status)) return json({ job });
  const { data, error } = await adminClient().from("music_generation_jobs").update({ status: "cancelled", failure_reason: "cancelled_by_user", error_message: null }).eq("id", job.id).select("*").single();
  if (error) throw error;
  await logSafetyEvent(userId, "job_cancelled", "Cancelled by user", { prior_status: job.status }, job.id);
  return json({ job: data });
}

async function health() {
  const { data: profiles, error } = await adminClient().from("music_provider_profiles").select("provider_key, display_name, adapter_key, default_model, default_model_version, technical_status, license_review_status, commercial_allowed, hosted_allowed, output_commercial_allowed").order("priority", { ascending: true });
  if (error) throw error;
  const { data: snapshots } = await adminClient().from("music_provider_health_snapshots").select("provider_key, status, gpu_online, gpu_name, vram_total_mb, vram_free_mb, model_loaded, api_latency_ms, queue_depth, supported_duration_seconds, provider_version, last_successful_generation_at, details, checked_at").order("checked_at", { ascending: false }).limit(25);
  const latestByProvider = new Map<string, unknown>();
  for (const snapshot of snapshots ?? []) if (!latestByProvider.has(snapshot.provider_key)) latestByProvider.set(snapshot.provider_key, snapshot);
  return json({
    providers: (profiles ?? []).map((profile) => ({
      ...profile,
      dispatch_allowed: providerDispatchAllowed(profile as ProviderProfile),
      health: latestByProvider.get(profile.provider_key) ?? null,
    })),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = (await req.json().catch(() => ({}))) as Json;
  if (body.action === "dispatch") return await dispatchCycle(req, body);
  if (body.action === "probe") return await probeProvider(req, body);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
  const client = userClient(req);
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return json({ error: "Invalid authentication" }, 401);
  try {
    if (body.action === "submit") return await submit(user.id, req, body);
    if (body.action === "status") return await checkStatus(user.id, body);
    if (body.action === "cancel") return await cancel(user.id, body);
    if (body.action === "health") return await health();
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: publicError(error, "Music service request failed") }, 500);
  }
});
