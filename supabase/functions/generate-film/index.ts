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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405);

  try {
    const { screenplay } = await request.json();
    if (typeof screenplay !== 'string' || !screenplay.trim()) {
      return json({ error: 'INVALID_REQUEST', message: 'A screenplay is required.' }, 400);
    }

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    const usingLovable = Boolean(lovableKey);
    const apiKey = lovableKey || openAIKey;

    if (!apiKey) {
      return json({
        error: 'SERVICE_NOT_CONFIGURED',
        message: 'Configure LOVABLE_API_KEY or OPENAI_API_KEY in Supabase Edge Function secrets.',
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
              'Convert the screenplay into one concise cinematic video-generation prompt. Describe subject, environment, movement, camera, lighting, visual style, and duration. Return plain text only.',
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
      return json({
        error: code,
        message: promptPayload?.error?.message || `Prompt provider returned HTTP ${promptResponse.status}.`,
      }, promptResponse.status === 402 || promptResponse.status === 429 ? promptResponse.status : 502);
    }

    const videoPrompt = promptPayload?.choices?.[0]?.message?.content?.trim();
    if (!videoPrompt) {
      return json({ error: 'EMPTY_RESPONSE', message: 'The prompt provider returned no content.' }, 502);
    }

    const webhookUrl = Deno.env.get('VIDEO_GENERATION_WEBHOOK_URL');
    const webhookToken = Deno.env.get('VIDEO_GENERATION_WEBHOOK_TOKEN');

    if (webhookUrl) {
      const videoResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
        },
        body: JSON.stringify({ screenplay: screenplay.trim(), prompt: videoPrompt }),
      });

      const videoPayload = await videoResponse.json().catch(() => ({}));
      if (!videoResponse.ok) {
        return json({
          error: 'VIDEO_PROVIDER_ERROR',
          message: videoPayload?.message || `Video provider returned HTTP ${videoResponse.status}.`,
        }, 502);
      }

      const videoUrl = videoPayload?.videoUrl || videoPayload?.url;
      if (!videoUrl) {
        return json({ error: 'EMPTY_VIDEO_RESPONSE', message: 'Video provider returned no video URL.' }, 502);
      }

      return json({ videoUrl, prompt: videoPrompt, provider: 'webhook' });
    }

    return json({
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      prompt: videoPrompt,
      provider: 'sample',
      message:
        'Film endpoint is working. Configure VIDEO_GENERATION_WEBHOOK_URL for real AI video generation.',
    });
  } catch (error) {
    console.error('generate-film error', error);
    return json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unexpected film generation error.',
    }, 500);
  }
});
