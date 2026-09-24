import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AIFilmProject } from './assetManagerService';
import {
  fetchRoleDraft, policyTestRole, saveRoleDraft, transitionRole,
  type FilmRole, type RoleDraft, type RoleProfile,
} from './roleStudioService';

const roles: { id: FilmRole; title: string; tools: string[]; intro: string }[] = [
  { id: 'teacher', title: 'Teacher', tools: ['lesson_search', 'quiz_builder'], intro: "I'm your AI teacher. What would you like to learn?" },
  { id: 'instructor', title: 'Instructor', tools: ['manual_search', 'progress_check'], intro: "I'm your AI instructor. We'll work through each step together." },
  { id: 'radio_dj', title: 'Radio DJ', tools: ['cleared_catalog', 'station_schedule'], intro: "Welcome to HNF Radio. I'm your AI DJ." },
  { id: 'host', title: 'Host / Presenter', tools: ['script_library', 'cue_sheet'], intro: "Welcome to AI Films. I'm your virtual host." },
  { id: 'support', title: 'Support Agent', tools: ['product_faq', 'create_handoff'], intro: "I'm your AI support assistant. How can I help?" },
];
const roleInfo = (id: FilmRole) => roles.find((item) => item.id === id)!;
const defaultProfile = (id: FilmRole): RoleProfile => ({
  avatar_version: 'avatar-v1', voice_version: 'voice-v1', introduction: roleInfo(id).intro,
  sources: [], tools: id === 'radio_dj' ? ['cleared_catalog'] : [],
  memory_scope: 'session', handoff: 'I can connect you with a person from the team.',
});

type Props = { project: AIFilmProject | null };

export default function RoleStudioWorkspace({ project }: Props) {
  const [role, setRole] = useState<FilmRole>('teacher');
  const [profile, setProfile] = useState<RoleProfile>(() => defaultProfile('teacher'));
  const [sourcesText, setSourcesText] = useState('');
  const [saved, setSaved] = useState<RoleDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('Connect a project to manage role profiles.');

  useEffect(() => {
    if (!project) { setSaved(null); setProfile(defaultProfile(role)); setSourcesText(''); setDirty(false); return; }
    let active = true;
    setBusy(true);
    setSaved(null);
    setProfile(defaultProfile(role));
    setSourcesText('');
    setDirty(false);
    fetchRoleDraft(project.id, role).then((draft) => {
      if (!active) return;
      setSaved(draft);
      setProfile(draft?.profile ?? defaultProfile(role));
      setSourcesText(draft?.profile.sources.join('\n') ?? '');
      setMessage(draft ? `${roleInfo(role).title} draft revision ${draft.revision} loaded.` : 'No saved role yet. Create its first draft.');
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Role draft could not be loaded.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [project?.id, role]);

  const update = (change: Partial<RoleProfile>) => { setProfile((previous) => ({ ...previous, ...change })); setDirty(true); };

  const refresh = async () => {
    if (!project) return;
    const draft = await fetchRoleDraft(project.id, role);
    setSaved(draft);
    setProfile(draft?.profile ?? defaultProfile(role));
    setSourcesText(draft?.profile.sources.join('\n') ?? '');
    setDirty(false);
  };

  const discard = () => {
    setProfile(saved?.profile ?? defaultProfile(role));
    setSourcesText(saved?.profile.sources.join('\n') ?? '');
    setDirty(false);
    setMessage('Unsaved changes discarded.');
  };

  const act = async (operation: 'save' | 'test' | 'submit-review' | 'approve' | 'publish') => {
    if (!project || busy) return;
    setBusy(true);
    try {
      if (operation === 'save') {
        const result = await saveRoleDraft(project.id, role, saved?.revision ?? 0, profile);
        await refresh();
        setMessage(`Draft revision ${result.revision} saved. Run its policy test before review.`);
      } else if (operation === 'test') {
        if (!saved || dirty) throw new Error('Save the current draft before running its policy test.');
        await policyTestRole(project.id, role, saved.revision, saved.profile);
        await refresh();
        setMessage('Policy test recorded for this revision. Review can now be requested.');
      } else {
        if (!saved || dirty) throw new Error('Save the current changes before continuing.');
        const result = await transitionRole(project.id, role, saved.revision, operation);
        await refresh();
        setMessage(operation === 'publish' ? `Role release v${result.version} published to the role store. No content was posted.` : `Role state: ${result.status}.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Role action failed.');
    } finally { setBusy(false); }
  };

  const info = roleInfo(role);
  const canEdit = Boolean(project) && !busy;
  const canAdvance = canEdit && !dirty && Boolean(saved);

  return (
    <section className="space-y-5" aria-labelledby="role-studio-heading">
      <div><p className="text-sm font-semibold uppercase tracking-[.25em] text-primary">AI Films · Avatar roles</p><h2 id="role-studio-heading" className="mt-2 text-3xl font-bold">Role Studio</h2><p className="mt-2 text-sm text-muted-foreground">Give one avatar distinct knowledge, voice, tools, and review rules for each job.</p></div>
      <Card className="border-primary/20 p-4 text-sm" role="status" aria-live="polite">{message}</Card>
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="h-max space-y-2 p-4">
          {roles.map((item) => <Button key={item.id} type="button" variant={role === item.id ? 'default' : 'outline'} className="w-full justify-start" disabled={busy || dirty} onClick={() => setRole(item.id)}>{item.title}</Button>)}
          <div className="rounded-lg border p-3 text-sm text-muted-foreground"><Badge variant="outline">Closed</Badge><p className="mt-2 font-medium text-foreground">Mental health support</p><p className="mt-1">Clinical and privacy review required. Public authoring is unavailable.</p></div>
        </Card>
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xl font-bold">{info.title}</h3><Badge variant="secondary">{saved ? `${saved.status} · draft r${saved.revision}${saved.published_version ? ` · release v${saved.published_version}` : ''}` : 'New draft'}</Badge></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Avatar version<Input value={profile.avatar_version} disabled={!canEdit} onChange={(event) => update({ avatar_version: event.target.value })} /></label><label className="space-y-2 text-sm font-medium">Voice version<Input value={profile.voice_version} disabled={!canEdit} onChange={(event) => update({ voice_version: event.target.value })} /></label></div>
          <label className="block space-y-2 text-sm font-medium">Introduction<textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" value={profile.introduction} disabled={!canEdit} onChange={(event) => update({ introduction: event.target.value })} /></label>
          <label className="block space-y-2 text-sm font-medium">Approved source IDs, one per line<textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" value={sourcesText} disabled={!canEdit} onChange={(event) => { setSourcesText(event.target.value); update({ sources: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) }); }} placeholder="lesson:approved-foundations" /></label>
          <fieldset><legend className="text-sm font-medium">Tools this role may use</legend><div className="mt-2 flex flex-wrap gap-4">{info.tools.map((tool) => <label key={tool} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={profile.tools.includes(tool)} disabled={!canEdit || (role === 'radio_dj' && tool === 'cleared_catalog')} onChange={(event) => update({ tools: event.target.checked ? [...profile.tools, tool] : profile.tools.filter((item) => item !== tool) })} />{tool.replaceAll('_', ' ')}</label>)}</div></fieldset>
          <label className="block space-y-2 text-sm font-medium">Memory scope<select className="w-full rounded-md border border-input bg-background px-3 py-2" value={profile.memory_scope} disabled={!canEdit} onChange={(event) => update({ memory_scope: event.target.value as RoleProfile['memory_scope'] })}><option value="none">No retained conversation</option><option value="session">Current session</option><option value="course">Course or program</option></select></label>
          <label className="block space-y-2 text-sm font-medium">Human handoff message<textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2" value={profile.handoff} disabled={!canEdit} onChange={(event) => update({ handoff: event.target.value })} /></label>
          <div className="flex flex-wrap gap-2"><Button type="button" disabled={!canEdit || !dirty} variant="outline" onClick={discard}>Discard changes</Button><Button type="button" disabled={!canEdit || (!dirty && Boolean(saved))} onClick={() => void act('save')}>Save draft</Button><Button type="button" variant="outline" disabled={!canAdvance || saved?.status !== 'draft'} onClick={() => void act('test')}>Run policy test</Button><Button type="button" variant="outline" disabled={!canAdvance || saved?.status !== 'draft' || saved?.tested_hash !== saved?.profile_hash} onClick={() => void act('submit-review')}>Request review</Button><Button type="button" variant="outline" disabled={!canAdvance || saved?.status !== 'review'} onClick={() => void act('approve')}>Approve</Button><Button type="button" disabled={!canAdvance || saved?.status !== 'approved'} onClick={() => void act('publish')}>Publish role version</Button></div>
          <p className="text-xs text-muted-foreground">The backend checks collaborator permissions and requires separate editor, reviewer, and publisher accounts. A policy test checks structure and tool permissions; it does not render an avatar or approve media rights.</p>
        </Card>
      </div>
    </section>
  );
}
