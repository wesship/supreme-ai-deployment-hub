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
    const { idea } = await request.json();
    if (typeof idea !== 'string' || !idea.trim()) {
      return json({ error: 'INVALID_REQUEST', message: 'A film idea is required.' }, 400);
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

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        messages: [
          {
            role: 'system',
            content:
              'You are a professional screenwriter. Return a concise production-ready screenplay with title, logline, characters, scene headings, visual action, dialogue, camera direction, sound notes, and a clear ending. Return plain text only.',
          },
          {
            role: 'user',
            content: `Create a compelling 2-3 minute short-film screenplay from this idea:\n\n${idea.trim()}`,
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = response.status === 402
        ? 'PAYMENT_REQUIRED'
        : response.status === 429
          ? 'RATE_LIMITED'
          : 'UPSTREAM_ERROR';
      return json({
        error: code,
        message: payload?.error?.message || `Screenplay provider returned HTTP ${response.status}.`,
      }, response.status === 402 || response.status === 429 ? response.status : 502);
    }

    const screenplay = payload?.choices?.[0]?.message?.content?.trim();
    if (!screenplay) {
      return json({ error: 'EMPTY_RESPONSE', message: 'The screenplay provider returned no content.' }, 502);
    }

    return json({ screenplay, provider: usingLovable ? 'lovable' : 'openai' });
  } catch (error) {
    console.error('generate-screenplay error', error);
    return json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unexpected screenplay generation error.',
    }, 500);
  }
});
