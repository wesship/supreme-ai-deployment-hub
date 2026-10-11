/** Public launch links only. No account, script, asset or token crosses origins. */
export const STUDIO_PREVIEW = 'https://id-preview--f4ee0149-5e2e-4726-bb45-0b98b776cc8f.lovable.app';
export const ACADEMY_PREVIEW = 'https://id-preview--c0c89d80-7d6b-4859-b52b-2c25e3c07df7.lovable.app/studio-lessons';
export const avatarUseCases = [
  { id: 'news_anchor', title: 'News anchor and HNF bulletin', description: 'Prepare a sourced 60-second bulletin with your approved character, narration, citations and captions.', outcome: 'Reviewed bulletin and render handoff', steps: ['Collect dated source evidence', 'Draft script and link citations', 'Review facts, media rights and likeness', 'Render with a verified MuseTalk worker', 'Approve the result for HNF TV or Radio'] },
  { id: 'avatar_podcast', title: 'Podcast host', description: 'Prepare a solo show with a consistent character, script, voice and virtual desk.', outcome: 'Reviewed episode plan', steps: ['Choose host and consent', 'Prepare episode script', 'Review voice and likeness', 'Render with a verified worker', 'Review and export episode'] },
  { id: 'interview', title: 'Interviews and conversations', description: 'Plan guest roles, questions and a two-seat set for recorded interviews.', outcome: 'Reviewed interview plan', steps: ['Confirm guest permission', 'Assign speakers', 'Prepare interview questions', 'Review timing and likeness', 'Render and approve output'] },
  { id: 'onboarding_demo', title: 'Onboarding and product demos', description: 'Create an avatar presenter for walkthroughs and repeatable onboarding.', outcome: 'Reviewed presenter script', steps: ['Define audience and goal', 'Write demonstration steps', 'Review factual sources', 'Render presenter', 'Review captions and export'] },
  { id: 'teacher_lesson', title: 'HNF Academy teacher', description: 'Structure explanations, objectives and practice around approved teaching sources.', outcome: 'Academy lesson package', steps: ['Set objectives', 'Attach reviewed sources', 'Write explanation and checks', 'Preview learner practice', 'Export and review in Academy'] },
  { id: 'instructor_workshop', title: 'Instructor workshop', description: 'Teach a procedure with demonstrations, learner practice and instructor review.', outcome: 'Workshop lesson package', steps: ['Define prerequisites', 'Prepare demonstration', 'Add practice and checkpoints', 'Review instructor notes', 'Export and review in Academy'] },
  { id: 'cinematic_character', title: 'AI film characters', description: 'Prepare consented characters and Unreal rig mappings for cinematic scenes.', outcome: 'Reviewed scene handoff', steps: ['Register character and consent', 'Map rig and animation assets', 'Prepare scene and voice tracks', 'Verify worker capabilities', 'Review render and export'] },
] as const;
export type AvatarTemplate = typeof avatarUseCases[number]['id'];
export function isAvatarTemplate(value: unknown): value is AvatarTemplate {
  return typeof value === 'string' && avatarUseCases.some(item => item.id === value);
}
export function studioLaunchUrl(template?: unknown): string {
  const url = new URL(STUDIO_PREVIEW);
  // Launch into project creation; allowlisted values only, no automatic submission.
  url.pathname = '/projects';
  if (isAvatarTemplate(template)) url.searchParams.set('template', template);
  return url.toString();
}
export function buildAvatarWorkflowBrief(template: AvatarTemplate) {
  const item = avatarUseCases.find(entry => entry.id === template);
  if (!item) throw new Error('Unknown avatar template');
  return {
    format: 'd3vonn.avatar-workflow-brief', version: 1,
    template: item.id, title: item.title, outcome: item.outcome,
    stage: 'draft', execution: 'disconnected', steps: [...item.steps],
    blockers: ['Verify consent and content review in Studio', 'Deploy and verify rendering worker for media output', 'Configure authenticated Hermes adapter before automated execution'],
  } as const;
}
