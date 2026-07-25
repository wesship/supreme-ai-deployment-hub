import { useEffect, useMemo, useState } from 'react';
import { Eye, FileUp, Save, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AIFilmAsset, AIFilmProject } from './assetManagerService';
import { fetchScenes, type FilmScene } from './canonSceneService';
import {
  createAssetPreviewUrl,
  getReleaseReadinessDetails,
  saveProductionPackage,
  uploadFilmAsset,
  type ProductionPackage,
} from './storagePackageService';

type Props = {
  project: AIFilmProject | null;
  assets: AIFilmAsset[];
  onAssetUploaded: () => Promise<void>;
};

const emptyPackage: ProductionPackage = {
  cameraPlan: '',
  lightingPlan: '',
  audioPlan: '',
  vfxPlan: '',
  editNotes: '',
};

export default function StoragePackageWorkspace({ project, assets, onAssetUploaded }: Props) {
  const [scenes, setScenes] = useState<FilmScene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [productionPackage, setProductionPackage] = useState<ProductionPackage>(emptyPackage);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Connect the Knowledge Core to upload media and edit production packages.');

  const refreshScenes = async () => {
    if (!project) return;
    const nextScenes = await fetchScenes(project.id);
    setScenes(nextScenes);
  };

  useEffect(() => {
    void refreshScenes();
  }, [project?.id]);

  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || null;

  useEffect(() => {
    if (!selectedScene) {
      setProductionPackage(emptyPackage);
      return;
    }
    setProductionPackage({
      cameraPlan: String(selectedScene.productionPackage.cameraPlan || ''),
      lightingPlan: String(selectedScene.productionPackage.lightingPlan || ''),
      audioPlan: String(selectedScene.productionPackage.audioPlan || ''),
      vfxPlan: String(selectedScene.productionPackage.vfxPlan || ''),
      editNotes: String(selectedScene.productionPackage.editNotes || ''),
    });
  }, [selectedSceneId, scenes]);

  const readiness = useMemo(() => getReleaseReadinessDetails(assets, scenes), [assets, scenes]);

  const upload = async (file: File | null) => {
    if (!project || !file) return;
    setBusy(true);
    try {
      await uploadFilmAsset(project.id, file);
      await onAssetUploaded();
      setMessage(`${file.name} uploaded and registered in the Knowledge Core.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The media file could not be uploaded.');
    } finally {
      setBusy(false);
    }
  };

  const preview = async (asset: AIFilmAsset) => {
    if (!asset.storagePath) return;
    setBusy(true);
    try {
      const signedUrl = await createAssetPreviewUrl(asset.storagePath);
      setPreviewUrls((current) => ({ ...current, [asset.id]: signedUrl }));
      setMessage(`Private preview created for ${asset.title}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'A private preview could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const savePackage = async () => {
    if (!selectedSceneId) return;
    setBusy(true);
    try {
      await saveProductionPackage(selectedSceneId, productionPackage);
      await refreshScenes();
      setMessage('Production package saved to scene memory.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The production package could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const uploadedAssets = assets.filter((asset) => Boolean(asset.storagePath));

  return (
    <section className="space-y-6" aria-labelledby="storage-package-heading">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Media + Production Packages</p>
        <h2 id="storage-package-heading" className="mt-2 text-3xl font-bold">Production Delivery</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Release readiness</p><p className="mt-2 text-2xl font-bold">{readiness.score}%</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Uploaded media</p><p className="mt-2 text-2xl font-bold">{readiness.uploadedAssets}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Canon assets</p><p className="mt-2 text-2xl font-bold">{readiness.canonAssets}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Passing scenes</p><p className="mt-2 text-2xl font-bold">{readiness.passingScenes}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Packaged scenes</p><p className="mt-2 text-2xl font-bold">{readiness.packagedScenes}</p></Card>
      </div>

      <Card className="border-primary/20 p-4 text-sm text-muted-foreground" role="status" aria-live="polite">{message}</Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="text-xl font-bold">Private Media Upload</h3><p className="mt-1 text-sm text-muted-foreground">Images, audio, video, and PDFs up to 50 MB.</p></div>
            <FileUp className="h-6 w-6 text-primary" />
          </div>
          <label htmlFor="film-media-upload" className="mt-5 block text-sm font-medium">Choose production media</label>
          <Input id="film-media-upload" className="mt-2" type="file" accept="image/*,audio/*,video/*,application/pdf" disabled={!project || busy} onChange={(event) => void upload(event.target.files?.[0] || null)} />

          <div className="mt-6 space-y-3">
            {uploadedAssets.length === 0 && <p className="text-sm text-muted-foreground">No uploaded production media yet.</p>}
            {uploadedAssets.map((asset) => (
              <div key={asset.id} className="rounded-xl border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="font-semibold">{asset.title}</p><p className="mt-1 text-xs text-muted-foreground">{asset.sourceFilename}</p></div>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void preview(asset)}><Eye className="mr-2 h-4 w-4" />Preview</Button>
                </div>
                {previewUrls[asset.id] && <img src={previewUrls[asset.id]} alt={`Private preview of ${asset.title}`} className="mt-4 max-h-64 w-full rounded-lg object-contain" />}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-bold">Production Package</h3><Sparkles className="h-6 w-6 text-primary" /></div>
          <label htmlFor="package-scene" className="mt-5 block text-sm font-medium">Scene</label>
          <select id="package-scene" className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2" value={selectedSceneId} onChange={(event) => setSelectedSceneId(event.target.value)}>
            <option value="">Select a scene</option>
            {scenes.map((scene) => <option key={scene.id} value={scene.id}>Scene {scene.sceneNumber}: {scene.title}</option>)}
          </select>

          {(['cameraPlan', 'lightingPlan', 'audioPlan', 'vfxPlan', 'editNotes'] as const).map((field) => {
            const labels: Record<keyof ProductionPackage, string> = { cameraPlan: 'Camera plan', lightingPlan: 'Lighting plan', audioPlan: 'Audio plan', vfxPlan: 'VFX plan', editNotes: 'Edit notes' };
            return <label key={field} className="mt-4 block text-sm font-medium">{labels[field]}<textarea className="mt-2 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={productionPackage[field]} onChange={(event) => setProductionPackage((current) => ({ ...current, [field]: event.target.value }))} /></label>;
          })}

          <Button className="mt-5" type="button" disabled={!selectedSceneId || busy} onClick={() => void savePackage()}><Save className="mr-2 h-4 w-4" />Save Production Package</Button>
          {selectedScene && Object.keys(selectedScene.productionPackage || {}).length > 0 && <Badge className="ml-3" variant="secondary">Package stored</Badge>}
        </Card>
      </div>
    </section>
  );
}
