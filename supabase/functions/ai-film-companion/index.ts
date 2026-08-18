import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) {
      return json({ error: 'UNAUTHORIZED', message: 'Authorization is required.' }, 401);
    }

    const { filmId, question } = await request.json();
    if (typeof filmId !== 'string' || !filmId.trim()) {
      return json({ error: 'INVALID_FILM', message: 'filmId is required.' }, 400);
    }
    if (typeof question !== 'string' || question.trim().length < 3 || question.length > 2000) {
      return json({ error: 'INVALID_QUESTION', message: 'Question must contain 3–2000 characters.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!supabaseUrl || !anonKey || !openAIKey) {
      return json({ error: 'SERVICE_NOT_CONFIGURED', message: 'Film companion service is not configured.' }, 503);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: 'UNAUTHORIZED', message: 'A valid user session is required.' }, 401);
    }

    const { data: flag, error: flagError } = await supabase
      .from('feature_flags')
      .select('enabled, active')
      .eq('key', 'ai_film_companion')
      .maybeSingle();
    if (flagError || !flag?.active || !flag.enabled) {
      return json({ error: 'FEATURE_DISABLED', message: 'The AI Film Companion is not enabled.' }, 503);
    }

    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: question.trim() }),
    });

    if (!embeddingResponse.ok) {
      const detail = await embeddingResponse.text();
      console.error('Embedding provider error:', detail);
      return json({ error: 'EMBEDDING_FAILED', message: 'Unable to search the film transcript.' }, 502);
    }

    const embeddingPayload = await embeddingResponse.json();
    const queryEmbedding = embeddingPayload?.data?.[0]?.embedding;
    if (!Array.isArray(queryEmbedding)) {
      return json({ error: 'EMBEDDING_FAILED', message: 'Embedding provider returned an invalid response.' }, 502);
    }

    const { data: matches, error: matchError } = await supabase.rpc('match_ai_film_transcript', {
      query_embedding: queryEmbedding,
      match_film_id: filmId,
      match_count: 6,
    });

    if (matchError) {
      console.error('Transcript retrieval error:', matchError);
      return json({ error: 'RETRIEVAL_FAILED', message: 'Unable to retrieve transcript context.' }, 500);
    }

    const chunks = Array.isArray(matches) ? matches : [];
    if (chunks.length === 0) {
      return json({
        answer: 'A transcript has not been indexed for this film yet. I can answer once the approved transcript is published.',
        citations: [],
      });
    }

    const context = chunks
      .map((chunk: any, index: number) =>
        `[${index + 1}] ${formatTime(chunk.start_seconds)}–${formatTime(chunk.end_seconds)}\n${chunk.content}`,
      )
      .join('\n\n');

    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You are the D3VONN AI Film Companion. Answer only from the supplied transcript context. Be concise, distinguish uncertainty, and cite supporting chunks using [1], [2], etc. Never invent scenes, dialogue, or facts.',
          },
          {
            role: 'user',
            content: `Film ID: ${filmId}\nQuestion: ${question.trim()}\n\nTranscript context:\n${context}`,
          },
        ],
      }),
    });

    if (!completionResponse.ok) {
      const detail = await completionResponse.text();
      console.error('Completion provider error:', detail);
      return json({ error: 'ANSWER_FAILED', message: 'Unable to generate a grounded answer.' }, 502);
    }

    const completionPayload = await completionResponse.json();
    const answer = completionPayload?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return json({ error: 'ANSWER_FAILED', message: 'The companion returned an empty answer.' }, 502);
    }

    return json({
      answer,
      citations: chunks.map((chunk: any) => ({
        startSeconds: Number(chunk.start_seconds || 0),
        endSeconds: Number(chunk.end_seconds || 0),
        content: String(chunk.content || ''),
        similarity: Number(chunk.similarity || 0),
      })),
    });
  } catch (error) {
    console.error('AI film companion error:', error);
    return json({ error: 'INTERNAL_ERROR', message: 'The AI Film Companion encountered an unexpected error.' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
