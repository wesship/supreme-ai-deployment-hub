import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

interface ComingSoonPageProps {
  title: string;
  description: string;
  backHref?: string;
  roadmap?: string[];
}

const ComingSoonPage = ({
  title,
  description,
  backHref = '/dashboard',
  roadmap,
}: ComingSoonPageProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <D3vonnPageBanner title={`D3VONN.IO • ${title}`} />
      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(backHref)}
          className="mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 mb-6">
            <Construction className="w-10 h-10 text-primary" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-medium mb-4">
            <Sparkles className="w-3 h-3" />
            On the Roadmap
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            {title}
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10">
            {description}
          </p>

          {roadmap && roadmap.length > 0 && (
            <div className="text-left bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-6 mb-10">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
                Planned capabilities
              </h2>
              <ul className="space-y-3">
                {roadmap.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-muted-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigate(backHref)}>
              Return to Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate('/contact')}>
              Request Early Access
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ComingSoonPage;
