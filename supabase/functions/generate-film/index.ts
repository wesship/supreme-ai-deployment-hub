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
    const { screenplay } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Generate a concise video prompt from the screenplay
    const promptResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: 'You are a video prompt engineer. Create concise, visual prompts for AI video generation that capture the essence and key visuals of a screenplay in 1-2 sentences.'
          },
          {
            role: 'user',
            content: `Create a video generation prompt from this screenplay:\n\n${screenplay}`
          }
        ],
      }),
    });

    if (!promptResponse.ok) {
      const errorText = await promptResponse.text();
      console.error('AI API error:', promptResponse.status, errorText);
      if (promptResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'PAYMENT_REQUIRED', message: 'AI credits exhausted. Please add credits in Lovable: Settings → Workspace → Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (promptResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'AI_GATEWAY_ERROR', status: promptResponse.status, details: errorText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const promptData = await promptResponse.json();
    const videoPrompt = promptData.choices[0].message.content;

    console.log('Generated video prompt:', videoPrompt);

    // For now, return a mock video URL since we need external video APIs
    // In production, integrate with Runway, Kling, Luma, or Veo APIs
    const mockVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

    return new Response(
      JSON.stringify({ 
        videoUrl: mockVideoUrl,
        prompt: videoPrompt,
        message: 'Video generation requires external API integration (Runway/Kling/Luma). Using sample video for now.'
      }),
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
