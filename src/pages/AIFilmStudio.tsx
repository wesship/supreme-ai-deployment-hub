import { useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle2, Database, Film, FolderKanban, Import, Search, ShieldCheck } from 'lucide-react';
import PublicPageShell from '@/components/shell/PublicPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { aiFilmImageCategories, aiFilmImageTaxonomy } from '@/features/ai-films/imageTaxonomy';
import {
  ensureSovereignSignalProject,
  fetchProjectAssets,
  importCompletedImageDump,
  type AIFilmAsset,
  type AIFilmProject,
} from '@/features/ai-films/assetManagerService';

const breadcrumbs = [{ label: 'AI Films', href: '/ai-films' }, { label: 'Studio' }, { label: 'Asset Manager' }];

const seedAssets: AIFilmAsset[] = aiFilmImageTaxonomy.map((asset, index) => ({
  id: `seed-${index}`,
  projectId: 'local-seed',
  title: asset.canonicalFilename.replace(/\.[^.]+$/, '').replaceAll('_', ' '),
  description: asset.description,
  sourceFilename: asset.sourceFilename,
  category: asset.category,
  subcategory: asset.subcategory,
  status: asset.category === 'ADMIN' ? 'approved' : 'canon',
  version: 1,
  tags: asset.tags,
  metadata: { canonical_filename: asset.canonicalFilename, local_seed: true },
}));

const AIFilmStudio = () => {
  const [project, setProject] = useState<AIFilmProject | null>(null);
  const [assets, setAssets] = useState<AIFilmAsset[]>(seedAssets);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Showing the completed 16-image dump. Sign in and deploy the foundation migration to sync it to Supabase.');

  const loadRemoteWorkspace = async () => {
    setBusy(true);
    try {
      const activeProject = await ensureSovereignSignalProject();
      const remoteAssets = await fetchProjectAssets(activeProject.id);
      setProject(activeProject);
      setAssets(remoteAssets.length > 0 ? remoteAssets : seedAssets);
      setMessage(remoteAssets.length > 0
        ? `Connected to ${activeProject.title}. ${remoteAssets.length} production assets loaded.`
        : `${activeProject.title} is connected. Import the completed dump to create its first production assets.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The Asset Manager is using its local canon seed until Supabase is ready.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadRemoteWorkspace();
  }, []);

  const importDump = async () => {
    setBusy(true);
    try {
      const activeProject = project || await ensureSovereignSignalProject();
      const imported = await importCompletedImageDump(activeProject.id);
      const remoteAssets = await fetchProjectAssets(activeProject.id);
      setProject(activeProject);
      setAssets(remoteAssets);
      setMessage(imported > 0 ? `${imported} assets imported into the Knowledge Core.` : 'The completed image dump is already fully imported.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The dump could not be imported.');
    } finally {
      setBusy(false);
    }
  };

  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesCategory = category === 'All' || asset.category === category;
      const haystack = `${asset.title} ${asset.description} ${asset.sourceFilename} ${asset.category} ${asset.subcategory} ${asset.tags.join(' ')}`.toLowerCase();
      return matchesCategory && (!normalized || haystack.includes(normalized));
    });
  }, [assets, category, query]);

  const canonCount = assets.filter((asset) => asset.status === 'canon').length;
  const categoryCount = new Set(assets.map((asset) => asset.category)).size;
  const remoteConnected = assets.some((asset) => !asset.id.startsWith('seed-'));

  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8" aria-labelledby="ai-film-studio-title">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="overflow-hidden rounded-3xl border border-border/70 bg-[radial-gradient(circle_at_80%_20%,rgba(34,211,238,.18),transparent_28%),linear-gradient(135deg,rgba(8,22,48,.98),rgba(2,6,15,.98))] p-7 text-white shadow-2xl sm:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <Badge variant="secondary">Release 1 · Knowledge Core</Badge>
                <h1 id="ai-film-studio-title" className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">AI Film Studio</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-blue-100">Manage canon, production assets, scene references, and the visual intelligence behind Sovereign Signal and The Genesis Weave.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={() => void loadRemoteWorkspace()} disabled={busy}><Database className="mr-2 h-4 w-4" />Connect Knowledge Core</Button>
                <Button type="button" onClick={() => void importDump()} disabled={busy}><Import className="mr-2 h-4 w-4" />Import Completed Dump</Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Production assets</p><p className="mt-2 text-3xl font-bold">{assets.length}</p></div><Film className="h-7 w-7 text-primary" /></div></Card>
            <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Canon assets</p><p className="mt-2 text-3xl font-bold">{canonCount}</p></div><ShieldCheck className="h-7 w-7 text-primary" /></div></Card>
            <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Categories</p><p className="mt-2 text-3xl font-bold">{categoryCount}</p></div><FolderKanban className="h-7 w-7 text-primary" /></div></Card>
            <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Knowledge Core</p><p className="mt-2 text-lg font-bold">{remoteConnected ? 'Connected' : 'Local seed'}</p></div>{remoteConnected ? <CheckCircle2 className="h-7 w-7 text-primary" /> : <Archive className="h-7 w-7 text-primary" />}</div></Card>
          </div>

          <Card className="border-primary/20 p-4 text-sm text-muted-foreground" role="status" aria-live="polite">{message}</Card>

          <section aria-labelledby="asset-library-heading">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div><p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Digital Asset Intelligence</p><h2 id="asset-library-heading" className="mt-2 text-3xl font-bold">Production Asset Library</h2></div>
              <div className="relative w-full lg:max-w-md"><label htmlFor="asset-search" className="sr-only">Search production assets</label><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="asset-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filename, tag, symbol, world, or category" className="pl-10" /></div>
            </div>

            <div className="mt-6 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Asset categories">
              {['All', ...aiFilmImageCategories].map((item) => <Button key={item} type="button" size="sm" variant={category === item ? 'default' : 'outline'} aria-pressed={category === item} onClick={() => setCategory(item)}>{item.replaceAll('_', ' ')}</Button>)}
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-live="polite">
              {visibleAssets.map((asset) => (
                <Card key={asset.id} className="overflow-hidden border-border/70">
                  <div className="aspect-video bg-[radial-gradient(circle_at_70%_25%,rgba(34,211,238,.28),transparent_30%),linear-gradient(135deg,#07152f,#02040a)] p-5">
                    <div className="flex items-start justify-between gap-3"><Badge variant="secondary">{asset.category.replaceAll('_', ' ')}</Badge><Badge variant="outline" className="border-white/30 text-white">{asset.status}</Badge></div>
                    <Film className="mt-12 h-10 w-10 text-cyan-200" aria-hidden="true" />
                  </div>
                  <div className="space-y-3 p-5">
                    <div><h3 className="font-bold leading-6">{asset.title}</h3><p className="mt-1 text-xs text-muted-foreground">{asset.sourceFilename} · v{asset.version}</p></div>
                    <p className="text-sm leading-6 text-muted-foreground">{asset.description}</p>
                    <div className="flex flex-wrap gap-2">{asset.tags.slice(0, 5).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </section>
    </PublicPageShell>
  );
};

export default AIFilmStudio;
