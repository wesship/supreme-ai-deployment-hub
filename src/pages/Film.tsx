import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Circle, Download, Film, Loader2, Sparkles, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const FILM_PAGE_URL = 'https://d3vonn.io/film';
const FILM_PAGE_TITLE = 'OpenMontage AI Film Studio | D3VONN.IO';
const FILM_PAGE_DESCRIPTION =
  'Create a governed AI screenplay and film through the D3VONN.IO OpenMontage production workflow.';
const OPENMONTAGE_SLUG = 'openmontage-video-intelligence-studio';

type StageState = 'pending' | 'running' | 'completed' | 'failed';
type Stage = { name: string; status: StageState; updatedAt?: string };

const stageIcon = (status: StageState) => {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
};

const FilmPage = () => {
  const navigate = useNavigate();
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [screenplay, setScreenplay] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [jobId, setJobId] = useState('');
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('idle');
  const [stages, setStages] = useState<Stage[]>([]);

  const handleFnError = async (err: any, fallback: string) => {
    let payload: any = null;
    try {
      if (err?.context && typeof err.context.json === 'function') payload = await err.context.json();
    } catch {
      // Use the connector error when the response body cannot be decoded.
    }
    const code = payload?.error;
    const message = payload?.message;
    if (payload?.jobId) setJobId(payload.jobId);
    if (code === 'PAYMENT_REQUIRED') {
      toast.error('Out of AI credits', { description: message });
    } else if (code === 'RATE_LIMITED') {
      toast.error('Rate limited', { description: message });
    } else if (code === 'SERVICE_NOT_CONFIGURED') {
      toast.error('Film provider is not configured', { description: message });
    } else {
      toast.error(message || err?.message || fallback);
    }
  };

  const findOpenMontageDeployment = async () => {
    const { data } = await (supabase as any)
      .from('deployed_agents')
      .select('id,status')
      .eq('template_id', 'agent-video-001')
      .order('deployed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id as string | undefined;
  };

  const generateFilm = async () => {
    if (!idea.trim()) {
      toast.error('Please enter your film idea');
      return;
    }

    setLoading(true);
    setVideoUrl('');
    setJobId('');
    setProvider('');
    setStatus('script');
    setStages([
      { name: 'research', status: 'completed' },
      { name: 'script', status: 'running' },
      ...['storyboard', 'assets', 'narration', 'render', 'review', 'publish'].map((name) => ({
        name,
        status: 'pending' as StageState,
      })),
    ]);

    try {
      const { data: screenplayData, error: screenplayError } = await supabase.functions.invoke(
        'generate-screenplay',
        { body: { idea: idea.trim(), agentSlug: OPENMONTAGE_SLUG } },
      );

      if (screenplayError) {
        await handleFnError(screenplayError, 'Failed to generate screenplay');
        setStatus('failed');
        return;
      }

      if (!screenplayData?.screenplay) {
        toast.error('The screenplay service returned an empty response');
        setStatus('failed');
        return;
      }

      setScreenplay(screenplayData.screenplay);
      setStatus('storyboard');
      toast.success('Screenplay generated. OpenMontage is preparing the production job.');

      const deployedAgentId = await findOpenMontageDeployment();
      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-film', {
        body: {
          idea: idea.trim(),
          screenplay: screenplayData.screenplay,
          agentSlug: OPENMONTAGE_SLUG,
          deployedAgentId,
        },
      });

      if (videoError) {
        await handleFnError(videoError, 'Failed to generate film');
        setStatus('failed');
        return;
      }

      if (videoData?.jobId) setJobId(videoData.jobId);
      if (videoData?.provider) setProvider(videoData.provider);
      if (videoData?.status) setStatus(videoData.status);
      if (Array.isArray(videoData?.stages)) setStages(videoData.stages);

      if (videoData?.videoUrl) {
        setVideoUrl(videoData.videoUrl);
        toast.success(
          videoData.provider === 'sample'
            ? 'OpenMontage workflow completed in sample mode.'
            : 'Film created successfully!',
        );
      } else if (videoData?.status === 'render') {
        toast.success('OpenMontage accepted the render job.', {
          description: videoData.message || 'The provider will complete the render asynchronously.',
        });
      } else {
        toast.error('The film service returned no playable video or render status');
      }
    } catch (error: any) {
      console.error('Film generation error:', error);
      setStatus('failed');
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
    anchor.download = 'openmontage-screenplay.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'D3VONN.IO OpenMontage AI Film Studio',
    url: FILM_PAGE_URL,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    description: FILM_PAGE_DESCRIPTION,
    creator: { '@type': 'Organization', name: 'D3VONN.IO', url: 'https://d3vonn.io' },
  };

  return (
    <div className="d3-os-shell min-h-screen bg-background">
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

      <D3vonnPageBanner title="OpenMontage Film Studio" />

      <div className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 sm:px-6">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button onClick={() => navigate('/dashboard')} variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Back
            </Button>
            <div className="flex items-center gap-3">
              <Film className="h-6 w-6 text-primary" aria-hidden="true" />
              <h1 className="text-xl font-bold">OpenMontage AI Filmmaker</h1>
              <Badge variant="outline">Hermes governed</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 sm:px-6 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <h2 className="mb-4 text-4xl font-bold">Create Your AI Film</h2>
            <p className="text-muted-foreground">
              OpenMontage routes your idea through research, script, storyboard, assets, narration, render, review, and publish.
            </p>
          </div>

          <Card className="d3-chrome-panel mb-6 border-0 p-4 sm:p-6">
            <label htmlFor="film-idea" className="sr-only">Film idea</label>
            <Textarea
              id="film-idea"
              placeholder="Describe your film idea..."
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              className="mb-4 min-h-[150px]"
              maxLength={5000}
            />
            <Button onClick={generateFilm} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {loading ? `OpenMontage: ${status === 'script' ? 'Writing screenplay' : 'Building production'}` : 'Generate Film & Screenplay'}
            </Button>
          </Card>

          {stages.length > 0 && (
            <Card className="mb-6 border-border bg-card/50 p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Production Workflow</h2>
                <div className="flex gap-2">
                  <Badge variant="secondary">{status}</Badge>
                  {provider && <Badge variant="outline">{provider}</Badge>}
                </div>
              </div>
              <div aria-live="polite" aria-label={`Production status: ${status}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stages.map((stage) => (
                  <div key={stage.name} className="flex items-center gap-2 rounded-lg border border-border/60 p-3">
                    {stageIcon(stage.status)}
                    <span className="text-sm font-medium capitalize">{stage.name}</span>
                  </div>
                ))}
              </div>
              {jobId && <p className="mt-4 text-xs text-muted-foreground">Job: {jobId}</p>}
            </Card>
          )}

          {screenplay && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <Card className="d3-chrome-panel border-0 p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-xl font-bold">Screenplay</h2>
                  <Button onClick={downloadScreenplay} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" /> Download TXT
                  </Button>
                </div>
                <pre className="whitespace-pre-wrap overflow-x-auto text-muted-foreground">{screenplay}</pre>
              </Card>
            </motion.div>
          )}

          {videoUrl && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="d3-chrome-panel border-0 p-4 sm:p-6">
                <h2 className="mb-4 text-xl font-bold">Your Film</h2>
                <video src={videoUrl} controls playsInline preload="metadata" className="w-full rounded-lg">
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
