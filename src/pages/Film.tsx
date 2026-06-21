import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Film, Sparkles, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

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
        } catch { /* ignore */ }
        const code = payload?.error;
        const message = payload?.message;
        if (code === 'PAYMENT_REQUIRED') {
          toast.error('Out of AI credits', { description: message ?? 'Add credits in Lovable: Settings → Workspace → Usage.' });
        } else if (code === 'RATE_LIMITED') {
          toast.error('Rate limited', { description: message ?? 'Please wait a moment and try again.' });
        } else {
          toast.error(message || err?.message || fallback);
        }
      };

      // Generate screenplay using Lovable AI
      const { data: screenplayData, error: screenplayError } = await supabase.functions.invoke('generate-screenplay', {
        body: { idea }
      });

      if (screenplayError) { await handleFnError(screenplayError, 'Failed to generate screenplay'); return; }
      setScreenplay(screenplayData.screenplay);

      // Generate video description
      toast.success('Screenplay generated! Now creating your film...');

      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-film', {
        body: { screenplay: screenplayData.screenplay }
      });

      if (videoError) { await handleFnError(videoError, 'Failed to generate film'); return; }

      setVideoUrl(videoData.videoUrl);
      toast.success('Film created successfully!');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to generate film');
    } finally {
      setLoading(false);
    }
  };

  const downloadScreenplay = () => {
    const blob = new Blob([screenplay], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'screenplay.txt';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      <D3vonnPageBanner title="D3VONN.IO Film Studio" />
      {/* Header */}
      <div className="border-b border-purple-500/20 bg-slate-900/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              size="sm"
              className="text-purple-400 hover:text-purple-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Film className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                AI Filmmaker
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Create Your AI Film
            </h2>
            <p className="text-slate-400">
              Describe your idea and watch it come to life in 4K
            </p>
          </div>

          <Card className="bg-slate-900/50 border-purple-500/20 p-6 mb-6">
            <Textarea
              placeholder="Describe your film idea... (e.g., 'A futuristic city where AI and humans coexist, showing daily life and challenges')"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              className="min-h-[150px] bg-slate-900/50 border-purple-500/30 text-white mb-4"
            />
            <Button
              onClick={generateFilm}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {loading ? 'Creating Magic...' : 'Generate Film & Screenplay'}
            </Button>
          </Card>

          {screenplay && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <Card className="bg-slate-900/50 border-purple-500/20 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Screenplay</h3>
                  <Button
                    onClick={downloadScreenplay}
                    variant="outline"
                    size="sm"
                    className="border-purple-500/30"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
                <pre className="text-slate-300 whitespace-pre-wrap">{screenplay}</pre>
              </Card>
            </motion.div>
          )}

          {videoUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="bg-slate-900/50 border-purple-500/20 p-6">
                <h3 className="text-xl font-bold text-white mb-4">Your Film</h3>
                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded-lg"
                />
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default FilmPage;
