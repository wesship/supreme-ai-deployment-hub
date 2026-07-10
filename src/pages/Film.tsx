import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowLeft, Film, Sparkles, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const FILM_PAGE_URL = 'https://d3vonn.io/film';
const FILM_PAGE_TITLE = 'AI Film Studio | D3VONN.IO';
const FILM_PAGE_DESCRIPTION =
  'Create an AI-generated screenplay and film from your original idea with the D3VONN.IO AI Film Studio.';

const FilmPage = () => {
  const navigate = useNavigate();
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [screenplay, setScreenplay] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const generateFilm = async () => {
    if (!idea.trim()) {
      toast.error('Please enter your film idea');
      return;
    }

    setLoading(true);
    try {
      const handleFnError = async (err: any, fallback: string) => {
        // supabase.functions.invoke wraps non-2xx in FunctionsHttpError with a Response on .context
        let payload: any = null;
        try {
          if (err?.context && typeof err.context.json === 'function') {
            payload = await err.context.json();
          }
        } catch {
          // Ignore malformed error payloads and fall back to the default message.
        }
        const code = payload?.error;
        const message = payload?.message;
        if (code === 'PAYMENT_REQUIRED') {
          toast.error('Out of AI credits', {
            description: message ?? 'Add credits in Lovable: Settings → Workspace → Usage.',
          });
        } else if (code === 'RATE_LIMITED') {
          toast.error('Rate limited', {
            description: message ?? 'Please wait a moment and try again.',
          });
        } else {
          toast.error(message || err?.message || fallback);
        }
      };

      const { data: screenplayData, error: screenplayError } = await supabase.functions.invoke(
        'generate-screenplay',
        { body: { idea: idea.trim() } },
      );

      if (screenplayError) {
        await handleFnError(screenplayError, 'Failed to generate screenplay');
        return;
      }

      if (!screenplayData?.screenplay) {
        toast.error('The screenplay service returned an empty response');
        return;
      }

      setScreenplay(screenplayData.screenplay);
      toast.success('Screenplay generated! Now creating your film...');

      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-film', {
        body: { screenplay: screenplayData.screenplay },
      });

      if (videoError) {
        await handleFnError(videoError, 'Failed to generate film');
        return;
      }

      if (!videoData?.videoUrl) {
        toast.error('The film service returned no playable video');
        return;
      }

      setVideoUrl(videoData.videoUrl);
      toast.success('Film created successfully!');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error?.message || 'Failed to generate film');
    } finally {
      setLoading(false);
    }
  };

  const downloadScreenplay = () => {
    const blob = new Blob([screenplay], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'd3vonn-screenplay.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'D3VONN.IO AI Film Studio',
    url: FILM_PAGE_URL,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    description: FILM_PAGE_DESCRIPTION,
    creator: {
      '@type': 'Organization',
      name: 'D3VONN.IO',
      url: 'https://d3vonn.io',
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{FILM_PAGE_TITLE}</title>
        <meta name="description" content={FILM_PAGE_DESCRIPTION} />
        <link rel="canonical" href={FILM_PAGE_URL} />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="D3VONN.IO" />
        <meta property="og:title" content={FILM_PAGE_TITLE} />
        <meta property="og:description" content={FILM_PAGE_DESCRIPTION} />
        <meta property="og:url" content={FILM_PAGE_URL} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={FILM_PAGE_TITLE} />
        <meta name="twitter:description" content={FILM_PAGE_DESCRIPTION} />

        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <D3vonnPageBanner title="D3VONN.IO Film Studio" />

      <div className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary/80"
            >
              <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Film className="w-6 h-6 text-primary" aria-hidden="true" />
              <h1 className="text-xl font-bold text-foreground">AI Filmmaker</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-4 text-foreground">Create Your AI Film</h2>
            <p className="text-muted-foreground">
              Describe your idea and generate an original screenplay and film.
            </p>
          </div>

          <Card className="bg-card/50 border-border p-6 mb-6">
            <label htmlFor="film-idea" className="sr-only">
              Film idea
            </label>
            <Textarea
              id="film-idea"
              placeholder="Describe your film idea... (e.g., 'A futuristic city where AI and humans coexist, showing daily life and challenges')"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              className="min-h-[150px] bg-background/50 border-border text-foreground mb-4"
              maxLength={5000}
            />
            <Button onClick={generateFilm} disabled={loading} className="w-full">
              <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
              {loading ? 'Creating Film...' : 'Generate Film & Screenplay'}
            </Button>
          </Card>

          {screenplay && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <Card className="bg-card/50 border-border p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2 className="text-xl font-bold text-foreground">Screenplay</h2>
                  <Button onClick={downloadScreenplay} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                    Download TXT
                  </Button>
                </div>
                <pre className="text-muted-foreground whitespace-pre-wrap overflow-x-auto">{screenplay}</pre>
              </Card>
            </motion.div>
          )}

          {videoUrl && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-card/50 border-border p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">Your Film</h2>
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full rounded-lg"
                >
                  Your browser does not support HTML video playback.
                </video>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default FilmPage;
