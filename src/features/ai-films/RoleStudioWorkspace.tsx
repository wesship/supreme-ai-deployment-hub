import { useEffect, useRef, useState } from 'react';
import Vapi from '@vapi-ai/web';
import { getVapiPublicKey } from '@/config/voice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AIFilmProject } from './assetManagerService';
import {
  createCharacter, fetchCharacters, fetchRoleDraft, policyTestRole, previewCharacterVoice, saveRoleDraft, transitionRole,
  type FilmCharacter, type FilmRole, type RoleDraft, type RoleProfile,
} from './roleStudioService';

const roles: { id: FilmRole; title: string; tools: string[]; intro: string }[] = [
  { id: 'teacher', title: 'Teacher', tools: ['lesson_search', 'quiz_builder'], intro: "I'm your AI teacher. What would you like to learn?" },
  { id: 'instructor', title: 'Instructor', tools: ['manual_search', 'progress_check'], intro: "I'm your AI instructor. We'll work through each step together." },
  { id: 'radio_dj', title: 'Radio DJ', tools: ['cleared_catalog', 'station_schedule'], intro: "Welcome to HNF Radio. I'm your AI DJ." },
  { id: 'host', title: 'Host / Presenter', tools: ['script_library', 'cue_sheet'], intro: "Welcome to AI Films. I'm your virtual host." },
  { id: 'support', title: 'Support Agent', tools: ['product_faq', 'create_handoff'], intro: "I'm your AI support assistant. How can I help?" },
];
const roleInfo = (id: FilmRole) => roles.find((item) => item.id === id)!;
const defaultProfile = (id: FilmRole, avatarVersion = ''): RoleProfile => ({
  avatar_version: avatarVersion, voice_version: '', introduction: roleInfo(id).intro,
  sources: [], tools: id === 'radio_dj' ? ['cleared_catalog'] : [],
  memory_scope: 'session', handoff: 'I can connect you with a person from the team.',
});

type Props = { project: AIFilmProject | null };

export default function RoleStudioWorkspace({ project }: Props) {
  const [role, setRole] = useState<FilmRole>('teacher');
  const [characters, setCharacters] = useState<FilmCharacter[]>([]);
  const [characterPage, setCharacterPage] = useState(0);
  const [hasMoreCharacters, setHasMoreCharacters] = useState(false);
  const [characterId, setCharacterId] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [characterSlug, setCharacterSlug] = useState('');
  const [characterAvatar, setCharacterAvatar] = useState('');
  const [creating, setCreating] = useState(false);
  const [profile, setProfile] = useState<RoleProfile>(() => defaultProfile('teacher'));
  const [sourcesText, setSourcesText] = useState('');
  const [saved, setSaved] = useState<RoleDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('Connect a project to manage role profiles.');
  const [previewActive, setPreviewActive] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const voiceRef = useRef<Vapi | null>(null);

  useEffect(() => () => {
    const instance = voiceRef.current;
    voiceRef.current = null;
    instance?.removeAllListeners();
    void instance?.stop();
    if (instance) setPreviewActive(false);
  }, [project?.id, characterId, role]);

  const toggleVoicePreview = async () => {
    if (previewBusy) return;
    setPreviewBusy(true);
    if (voiceRef.current) {
      const current = voiceRef.current;
      voiceRef.current = null;
      current.removeAllListeners();
      try { await current.stop(); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Voice preview could not stop cleanly.'); }
      finally { setPreviewActive(false); setPreviewBusy(false); }
      return;
    }
    try {
      if (!project || !characterId || !saved?.published_version) throw new Error('Publish a character role first.');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable in this browser.');
      const session = await previewCharacterVoice(project.id, characterId, role);
      const instance = new Vapi(getVapiPublicKey());
      voiceRef.current = instance;
      instance.on('call-end', () => { instance.removeAllListeners(); voiceRef.current = null; setPreviewActive(false); });
      instance.on('error', () => { instance.removeAllListeners(); void instance.stop(); voiceRef.current = null; setPreviewActive(false); setMessage('Voice preview disconnected.'); });
      await instance.start(session.assistant as Parameters<Vapi['start']>[0]);
      setPreviewActive(true);
      setMessage(`Playing ${roleInfo(role).title} release v${session.release_version} as an AI voice preview.`);
    } catch (error) {
      const instance = voiceRef.current;
      voiceRef.current = null;
      instance?.removeAllListeners();
      void instance?.stop();
      setPreviewActive(false);
      setMessage(error instanceof Error ? error.message : 'Voice preview could not start.');
    } finally { setPreviewBusy(false); }
  };

  useEffect(() => {
    if (!project) { setCharacters([]); setCharacterId(''); setHasMoreCharacters(false); return; }
    let active = true;
    setCharacterId('');
    setCharacterPage(0);
    fetchCharacters(project.id).then(({ items, has_more }) => {
      if (!active) return;
      setCharacters(items);
      setHasMoreCharacters(has_more);
      setCharacterId(items[0]?.id ?? '');
      if (!items.length) setMessage('Create a character to start authoring its roles.');
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Characters could not be loaded.');
    });
    return () => { active = false; };
  }, [project?.id]);

  const loadMoreCharacters = async () => {
    if (!project || creating || !hasMoreCharacters) return;
    setCreating(true);
    try {
      const next = characterPage + 1;
      const result = await fetchCharacters(project.id, next);
      setCharacters((previous) => [...previous, ...result.items]);
      setCharacterPage(next);
      setHasMoreCharacters(result.has_more);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'More characters could not be loaded.');
    } finally { setCreating(false); }
  };

  const addCharacter = async () => {
    if (!project || creating || previewBusy || previewActive || !characterName.trim() || !characterSlug.trim() || !characterAvatar.trim()) return;
    setCreating(true);
    try {
      const created = await createCharacter(project.id, { name: characterName.trim(), slug: characterSlug.trim(),
        avatar_version: characterAvatar.trim(), description: '' });
      setCharacters((previous) => [...previous, created]);
      setCharacterId(created.id);
      setCharacterName(''); setCharacterSlug(''); setCharacterAvatar('');
      setMessage(`${created.name} created. Add an approved source and save the first role draft.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Character could not be created.');
    } finally { setCreating(false); }
  };

  const activeCharacter = characters.find((item) => item.id === characterId);
  const avatarVersion = activeCharacter?.avatar_version;
  const blankProfile = () => defaultProfile(role, avatarVersion);

  useEffect(() => {
    if (!project || !characterId) { setSaved(null); setProfile(defaultProfile(role)); setSourcesText(''); setDirty(false); return; }
    let active = true;
    setBusy(true);
    setSaved(null);
    setProfile(defaultProfile(role, avatarVersion));
    setSourcesText('');
    setDirty(false);
    fetchRoleDraft(project.id, characterId, role).then((draft) => {
      if (!active) return;
      setSaved(draft);
      setProfile(draft?.profile ?? defaultProfile(role, avatarVersion));
      setSourcesText(draft?.profile.sources.join('\n') ?? '');
      setMessage(draft ? `${roleInfo(role).title} draft revision ${draft.revision} loaded.` : 'No saved role yet. Create its first draft.');
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Role draft could not be loaded.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [project?.id, characterId, role, avatarVersion]);

  const update = (change: Partial<RoleProfile>) => { setProfile((previous) => ({ ...previous, ...change })); setDirty(true); };

  const refresh = async () => {
    if (!project || !characterId) return;
    const draft = await fetchRoleDraft(project.id, characterId, role);
    setSaved(draft);
    setProfile(draft?.profile ?? blankProfile());
    setSourcesText(draft?.profile.sources.join('\n') ?? '');
    setDirty(false);
  };

  const discard = () => {
    setProfile(saved?.profile ?? blankProfile());
    setSourcesText(saved?.profile.sources.join('\n') ?? '');
    setDirty(false);
    setMessage('Unsaved changes discarded.');
  };

  const act = async (operation: 'save' | 'test' | 'submit-review' | 'approve' | 'publish') => {
    if (!project || !characterId || busy) return;
    setBusy(true);
    try {
      if (operation === 'save') {
        const result = await saveRoleDraft(project.id, characterId, role, saved?.revision ?? 0, profile);
        await refresh();
        setMessage(`Draft revision ${result.revision} saved. Run its policy test before review.`);
      } else if (operation === 'test') {
        if (!saved || dirty) throw new Error('Save the current draft before running its policy test.');
        await policyTestRole(project.id, characterId, role, saved.revision);
        await refresh();
        setMessage('Policy test recorded for this revision. Review can now be requested.');
      } else {
        if (!saved || dirty) throw new Error('Save the current changes before continuing.');
        const result = await transitionRole(project.id, characterId, role, saved.revision, operation);
        await refresh();
        setMessage(operation === 'publish' ? `Role release v${result.version} published to the role store. No content was posted.` : `Role state: ${result.status}.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Role action failed.');
    } finally { setBusy(false); }
  };

  const info = roleInfo(role);
  const canEdit = Boolean(project && characterId) && !busy;
  const canAdvance = canEdit && !dirty && Boolean(saved);

  return (
    <section className="space-y-5" aria-labelledby="role-studio-heading">
      <div><p className="text-sm font-semibold uppercase tracking-[.25em] text-primary">AI Films · Avatar roles</p><h2 id="role-studio-heading" className="mt-2 text-3xl font-bold">Role Studio</h2><p className="mt-2 text-sm text-muted-foreground">Give one avatar distinct knowledge, voice, tools, and review rules for each job.</p></div>
      <Card className="border-primary/20 p-4 text-sm" role="status" aria-live="polite">{message}</Card>
      <Card className="space-y-3 p-4">
        <label className="block space-y-2 text-sm font-medium">Character identity
          <select className="w-full rounded-md border border-input bg-background px-3 py-2" value={characterId}
            disabled={!project || busy || dirty || creating || previewBusy || previewActive} onChange={(event) => setCharacterId(event.target.value)}>
            <option value="">{characters.length ? 'Select a character' : 'Create the first character'}</option>
            {characters.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.slug})</option>)}
          </select>
        </label>
        {hasMoreCharacters && <Button type="button" variant="outline" disabled={!project || busy || dirty || creating} onClick={() => void loadMoreCharacters()}>Load more characters</Button>}
        <div className="flex flex-wrap gap-2">
          <Input className="min-w-40 flex-1" aria-label="New character name" placeholder="Character name" value={characterName} disabled={!project || dirty || creating || previewBusy || previewActive} onChange={(event) => setCharacterName(event.target.value)} />
          <Input className="min-w-40 flex-1" aria-label="New character slug" placeholder="unique-slug" value={characterSlug} disabled={!project || dirty || creating || previewBusy || previewActive} onChange={(event) => setCharacterSlug(event.target.value)} />
          <Input className="min-w-40 flex-1" aria-label="Character avatar asset version" placeholder="Approved avatar asset version" value={characterAvatar} disabled={!project || dirty || creating || previewBusy || previewActive} onChange={(event) => setCharacterAvatar(event.target.value)} />
          <Button type="button" disabled={!project || dirty || creating || previewBusy || previewActive || !characterName.trim() || !characterSlug.trim() || !characterAvatar.trim()} onClick={() => void addCharacter()}>Create character</Button>
        </div>
        <p className="text-xs text-muted-foreground">Each character has an independent identity and separate reviewed versions for every role. Character names and slugs identify content; consent and media rights must be verified before production.</p>
      </Card>
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="h-max space-y-2 p-4">
          {roles.map((item) => <Button key={item.id} type="button" variant={role === item.id ? 'default' : 'outline'} className="w-full justify-start" disabled={busy || dirty || previewBusy || previewActive} onClick={() => setRole(item.id)}>{item.title}</Button>)}
          <div className="rounded-lg border p-3 text-sm text-muted-foreground"><Badge variant="outline">Closed</Badge><p className="mt-2 font-medium text-foreground">Mental health support</p><p className="mt-1">Clinical and privacy review required. Public authoring is unavailable.</p></div>
        </Card>
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xl font-bold">{info.title}</h3><Badge variant="secondary">{saved ? `${saved.status} · draft r${saved.revision}${saved.published_version ? ` · release v${saved.published_version}` : ''}` : 'New draft'}</Badge></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Character avatar version<Input value={profile.avatar_version} disabled readOnly /></label><label className="space-y-2 text-sm font-medium">Role voice ID (ElevenLabs for preview)<Input value={profile.voice_version} disabled={!canEdit} onChange={(event) => update({ voice_version: event.target.value })} /></label></div>
          <label className="block space-y-2 text-sm font-medium">Introduction<textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" value={profile.introduction} disabled={!canEdit} onChange={(event) => update({ introduction: event.target.value })} /></label>
          <label className="block space-y-2 text-sm font-medium">Approved source IDs, one per line<textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" value={sourcesText} disabled={!canEdit} onChange={(event) => { setSourcesText(event.target.value); update({ sources: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) }); }} placeholder="lesson:approved-foundations" /></label>
          <fieldset><legend className="text-sm font-medium">Tools this role may use</legend><div className="mt-2 flex flex-wrap gap-4">{info.tools.map((tool) => <label key={tool} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={profile.tools.includes(tool)} disabled={!canEdit || (role === 'radio_dj' && tool === 'cleared_catalog')} onChange={(event) => update({ tools: event.target.checked ? [...profile.tools, tool] : profile.tools.filter((item) => item !== tool) })} />{tool.replaceAll('_', ' ')}</label>)}</div></fieldset>
          <label className="block space-y-2 text-sm font-medium">Memory scope<select className="w-full rounded-md border border-input bg-background px-3 py-2" value={profile.memory_scope} disabled={!canEdit} onChange={(event) => update({ memory_scope: event.target.value as RoleProfile['memory_scope'] })}><option value="none">No retained conversation</option><option value="session">Current session</option><option value="course">Course or program</option></select></label>
          <label className="block space-y-2 text-sm font-medium">Human handoff message<textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2" value={profile.handoff} disabled={!canEdit} onChange={(event) => update({ handoff: event.target.value })} /></label>
          <div className="flex flex-wrap gap-2"><Button type="button" disabled={!canEdit || !dirty} variant="outline" onClick={discard}>Discard changes</Button><Button type="button" disabled={!canEdit || (!dirty && Boolean(saved))} onClick={() => void act('save')}>Save draft</Button><Button type="button" variant="outline" disabled={!canAdvance || saved?.status !== 'draft'} onClick={() => void act('test')}>Run policy test</Button><Button type="button" variant="outline" disabled={!canAdvance || saved?.status !== 'draft' || saved?.tested_hash !== saved?.profile_hash} onClick={() => void act('submit-review')}>Request review</Button><Button type="button" variant="outline" disabled={!canAdvance || saved?.status !== 'review'} onClick={() => void act('approve')}>Approve</Button><Button type="button" disabled={!canAdvance || saved?.status !== 'approved'} onClick={() => void act('publish')}>Publish role version</Button></div>
          {import.meta.env.VITE_AI_FILMS_CHARACTER_VOICE_PREVIEW_ENABLED === 'true' && <Button type="button" variant="outline" disabled={previewBusy || (!previewActive && (!project || !characterId || !saved?.published_version || busy))} onClick={() => void toggleVoicePreview()}>{previewActive ? 'Stop voice preview' : 'Preview released voice'}</Button>}
          <p className="text-xs text-muted-foreground">Voice preview rehearses the approved introduction only. It has no role knowledge retrieval, broadcast control, or Hermes action tools.</p>
          <p className="text-xs text-muted-foreground">The backend checks collaborator permissions and requires separate editor, reviewer, and publisher accounts. A policy test checks structure and tool permissions; it does not render an avatar or approve media rights.</p>
        </Card>
      </div>
    </section>
  );
}
