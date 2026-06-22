import React from 'react';
import { Download as DownloadIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const REPO_BASE = 'https://github.com/d3vonn/devonn.ai';

const downloads = [
  {
    title: 'Backend (FastAPI)',
    href: `${REPO_BASE}/archive/refs/heads/main.zip`,
    label: 'Download ZIP',
  },
  {
    title: 'Frontend (React)',
    href: `${REPO_BASE}/archive/refs/heads/main.zip`,
    label: 'Download ZIP',
  },
  {
    title: 'Environment + Docker',
    href: `${REPO_BASE}/raw/main/docker-compose.yml`,
    label: 'Download Files',
  },
];

const DownloadSection: React.FC = () => {
  const handleDownload = (href: string, title: string) => {
    try {
      window.open(href, '_blank', 'noopener,noreferrer');
      toast.success(`Opening ${title} download`);
    } catch {
      toast.error('Unable to start download');
    }
  };

  return (
    <section className="py-6 rounded-lg border bg-card/40 my-8">
      <div className="px-6">
        <h3 className="text-xl font-bold mb-2 text-foreground">Download Everything</h3>
        <p className="text-muted-foreground mb-4">Get all the components you need to build your AI agent factory</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6">
        {downloads.map((d) => (
          <Card key={d.title} className="bg-background/80 backdrop-blur hover:bg-background transition-colors">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base">{d.title}</CardTitle>
            </CardHeader>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleDownload(d.href, d.title)}
              >
                <DownloadIcon className="mr-2 h-4 w-4" />
                {d.label}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default DownloadSection;
