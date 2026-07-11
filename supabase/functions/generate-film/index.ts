const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const OPENMONTAGE_STAGES = [
  'research',
  'script',
  'storyboard',
  'assets',
  'narration',
  'render',
  'review',
  'publish',
] as const;

type StageName = typeof OPENMONTAGE_STAGES[number];
type StageRecord = {
  name: StageName;
  status: 'pending' | 'running' | 'completed' | 'failed';
  updatedAt: string;
};

const makeStages = (active: StageName): StageRecord[] => {
  const activeIndex = OPENMONTAGE_STAGES.indexOf(active);
  return OPENMONTAGE_STAGES.map((name, index) => ({
    name,
    status: index < activeIndex ? 'completed' : index === activeIndex ? 'running' : 'pending',
    updatedAt: new Date().toISOString(),
  }));
};

const getJwtSubject = (authorization: string | null) => {
  if (!authorization?.startsWith('Bearer ')) return null;
  try {
    const payload = authorization.slice(7).split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return typeof decoded.sub === 'string' ? decoded.sub : null;
  } catch {
    return null;
  }
};

const persistJob = async (
  authorization: string | null,
  row: Record<string, unknown>,
) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey || !authorization) return null;

  const response = await fetch(`${supabaseUrl}/rest/v1/openmontage_jobs`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: authorization,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    console.error('openmontage job insert failed', response.status, await response.text());
    return null;
  }

  const payload = await response.json().catch(() => []);
  return payload?.[0] ?? null;
};

const updateJob = async (
  authorization: string | null,
  id: string | null,
  updates: Record<string, unknown>,
) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey || !authorization || !id) return;

  const response = await fetch(`${supabaseUrl}/rest/v1/openmontage_jobs?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: anonKey,
      Authorization: authorization,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    console.error('openmontage job update failed', response.status, await response.text());
  }
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405);

  const authorization = request.headers.get('Authorization');
  let jobId: string | null = null;

  try {
    const body = await request.json();
    const screenplay = body?.screenplay;
    const idea = typeof body?.idea === 'string' ? body.idea.trim() : null;
    const agentSlug = typeof body?.agentSlug === 'string'
      ? body.agentSlug
      : 'openmontage-video-intelligence-studio';
    const deployedAgentId = typeof body?.deployedAgentId === 'string' ? body.deployedAgentId : null;

    if (typeof screenplay !== 'string' || !screenplay.trim()) {
      return json({ error: 'INVALID_REQUEST', message: 'A screenplay is required.' }, 400);
    }

    const userId = getJwtSubject(authorization);
    const initialStages = makeStages('storyboard');
    const job = await persistJob(authorization, {
      user_id: userId,
      deployed_agent_id: deployedAgentId,
      agent_slug: agentSlug,
      idea,
      screenplay: screenplay.trim(),
      status: 'storyboard',
      stages: initialStages,
      metadata: { source: 'd3vonn-film-studio', version: '1.0.0' },
    });
    jobId = job?.id ?? null;

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    const usingLovable = Boolean(lovableKey);
    const apiKey = lovableKey || openAIKey;

    if (!apiKey) {
      await updateJob(authorization, jobId, {
        status: 'failed',
        stages: makeStages('storyboard').map((stage) =>
          stage.name === 'storyboard' ? { ...stage, status: 'failed' } : stage
        ),
        error: { code: 'SERVICE_NOT_CONFIGURED' },
      });
      return json({
        error: 'SERVICE_NOT_CONFIGURED',
        message: 'Configure LOVABLE_API_KEY or OPENAI_API_KEY in Supabase Edge Function secrets.',
        jobId,
      }, 503);
    }

    const endpoint = usingLovable
      ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const model = usingLovable
      ? 'google/gemini-2.5-flash'
      : Deno.env.get('OPENAI_SCREENPLAY_MODEL') || 'gpt-4o-mini';

    const promptResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content:
              'You are the OpenMontage storyboard and render-prompt engine. Convert the screenplay into one concise cinematic generation prompt including subject, environment, action, shot sequence, camera, lighting, sound, visual style, and duration. Return plain text only.',
          },
          { role: 'user', content: screenplay.trim() },
        ],
      }),
    });

    const promptPayload = await promptResponse.json().catch(() => ({}));
    if (!promptResponse.ok) {
      const code = promptResponse.status === 402
        ? 'PAYMENT_REQUIRED'
        : promptResponse.status === 429
          ? 'RATE_LIMITED'
          : 'UPSTREAM_ERROR';
      await updateJob(authorization, jobId, {
        status: 'failed',
        error: { code, upstreamStatus: promptResponse.status },
      });
      return json({
        error: code,
        message: promptPayload?.error?.message || `Prompt provider returned HTTP ${promptResponse.status}.`,
        jobId,
      }, promptResponse.status === 402 || promptResponse.status === 429 ? promptResponse.status : 502);
    }

    const videoPrompt = promptPayload?.choices?.[0]?.message?.content?.trim();
    if (!videoPrompt) {
      await updateJob(authorization, jobId, { status: 'failed', error: { code: 'EMPTY_RESPONSE' } });
      return json({ error: 'EMPTY_RESPONSE', message: 'The prompt provider returned no content.', jobId }, 502);
    }

    await updateJob(authorization, jobId, {
      video_prompt: videoPrompt,
      status: 'render',
      stages: makeStages('render'),
    });

    const webhookUrl = Deno.env.get('OPENMONTAGE_WEBHOOK_URL') || Deno.env.get('VIDEO_GENERATION_WEBHOOK_URL');
    const webhookToken = Deno.env.get('OPENMONTAGE_WEBHOOK_TOKEN') || Deno.env.get('VIDEO_GENERATION_WEBHOOK_TOKEN');

    if (webhookUrl) {
      const videoResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
        },
        body: JSON.stringify({
          jobId,
          agentSlug,
          screenplay: screenplay.trim(),
          prompt: videoPrompt,
          stages: OPENMONTAGE_STAGES,
          callbackUrl: Deno.env.get('OPENMONTAGE_CALLBACK_URL') || null,
        }),
      });

      const videoPayload = await videoResponse.json().catch(() => ({}));
      if (!videoResponse.ok) {
        await updateJob(authorization, jobId, {
          status: 'failed',
          error: { code: 'VIDEO_PROVIDER_ERROR', upstreamStatus: videoResponse.status },
        });
        return json({
          error: 'VIDEO_PROVIDER_ERROR',
          message: videoPayload?.message || `Video provider returned HTTP ${videoResponse.status}.`,
          jobId,
        }, 502);
      }

      const videoUrl = videoPayload?.videoUrl || videoPayload?.url;
      const providerJobId = videoPayload?.jobId || videoPayload?.id || null;
      if (!videoUrl) {
        await updateJob(authorization, jobId, {
          status: 'render',
          provider: 'openmontage-webhook',
          provider_job_id: providerJobId,
          metadata: { pending: true, providerResponse: videoPayload },
        });
        return json({
          jobId,
          providerJobId,
          prompt: videoPrompt,
          provider: 'openmontage-webhook',
          status: 'render',
          stages: makeStages('render'),
          message: 'OpenMontage accepted the render job. Polling/callback completion is required.',
        }, 202);
      }

      const completedStages = OPENMONTAGE_STAGES.map((name) => ({
        name,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      }));
      await updateJob(authorization, jobId, {
        provider: 'openmontage-webhook',
        provider_job_id: providerJobId,
        video_url: videoUrl,
        status: 'completed',
        stages: completedStages,
        completed_at: new Date().toISOString(),
      });

      return json({
        jobId,
        providerJobId,
        videoUrl,
        prompt: videoPrompt,
        provider: 'openmontage-webhook',
        status: 'completed',
        stages: completedStages,
      });
    }

    const sampleVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const reviewStages = makeStages('review');
    await updateJob(authorization, jobId, {
      provider: 'sample',
      video_url: sampleVideoUrl,
      status: 'review',
      stages: reviewStages,
      metadata: { sample: true, configurationRequired: 'OPENMONTAGE_WEBHOOK_URL' },
    });

    return json({
      jobId,
      videoUrl: sampleVideoUrl,
      prompt: videoPrompt,
      provider: 'sample',
      status: 'review',
      stages: reviewStages,
      message: 'OpenMontage workflow is active in sample mode. Configure OPENMONTAGE_WEBHOOK_URL for real rendering.',
    });
  } catch (error) {
    console.error('generate-film error', error);
    await updateJob(authorization, jobId, {
      status: 'failed',
      error: { message: error instanceof Error ? error.message : 'Unexpected film generation error.' },
    });
    return json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unexpected film generation error.',
      jobId,
    }, 500);
  }
});
