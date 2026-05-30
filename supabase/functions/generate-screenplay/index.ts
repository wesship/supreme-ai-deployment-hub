import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { idea } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a professional screenplay writer. Create detailed, cinematic screenplays with scene descriptions, dialogue, and camera directions. Format in standard screenplay format.'
          },
          {
            role: 'user',
            content: `Create a compelling 2-3 minute short film screenplay based on this idea: ${idea}\n\nInclude:\n- Scene headings\n- Detailed visual descriptions\n- Dialogue (if needed)\n- Camera movements\n- Sound design notes`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);

      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: 'PAYMENT_REQUIRED',
            message: 'AI credits exhausted. Please add credits in Lovable: Settings → Workspace → Usage.',
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: 'RATE_LIMITED',
            message: 'Too many requests. Please wait a moment and try again.',
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'AI_GATEWAY_ERROR', status: response.status, details: errorText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const screenplay = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ screenplay }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
