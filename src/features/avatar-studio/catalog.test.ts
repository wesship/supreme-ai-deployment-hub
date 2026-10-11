import { describe, expect, it } from 'vitest';
import { avatarUseCases, buildAvatarWorkflowBrief, isAvatarTemplate, STUDIO_PREVIEW, studioLaunchUrl } from './catalog';
describe('Avatar Studio cross-origin boundary', () => {
  it('launches every supported template on the fixed Studio origin with only a template query', () => {
    for (const item of avatarUseCases) {
      const url = new URL(studioLaunchUrl(item.id));
      expect(url.origin).toBe(new URL(STUDIO_PREVIEW).origin);
      expect(url.pathname).toBe('/projects');
      expect([...url.searchParams]).toEqual([['template', item.id]]);
    }
  });
  it.each(['https://evil.example', 'teacher_lesson&token=secret', '../admin', '', null, { id: 'interview' }])('does not forward an untrusted template %j', value => {
    expect(isAvatarTemplate(value)).toBe(false);
    expect(new URL(studioLaunchUrl(value)).search).toBe('');
  });
  it('exports a planning brief with no execution or private assets', () => {
    const brief = buildAvatarWorkflowBrief('teacher_lesson');
    expect(brief.stage).toBe('draft');
    expect(brief.execution).toBe('disconnected');
    expect(brief.blockers.length).toBeGreaterThan(0);
    expect(Object.keys(brief)).toEqual(['format', 'version', 'template', 'title', 'outcome', 'stage', 'execution', 'steps', 'blockers']);
    expect(brief).not.toHaveProperty('project');
    expect(brief).not.toHaveProperty('assets');
  });
  it('launches a sourced news bulletin with explicit review and verified rendering steps', () => {
    const brief = buildAvatarWorkflowBrief('news_anchor');
    expect(brief.steps).toContain('Collect dated source evidence');
    expect(brief.steps).toContain('Render with a verified MuseTalk worker');
    expect(new URL(studioLaunchUrl('news_anchor')).searchParams.get('template')).toBe('news_anchor');
    expect(brief.execution).toBe('disconnected');
  });
  it('rejects unsupported template even when callers bypass TypeScript', () => {
    expect(() => buildAvatarWorkflowBrief('untrusted' as never)).toThrow('Unknown avatar template');
  });
});
