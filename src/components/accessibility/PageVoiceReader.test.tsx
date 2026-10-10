import { describe, expect, it } from 'vitest';

import { chunkReadableText, extractReadablePageText } from './PageVoiceReader';

describe('PageVoiceReader', () => {
  it('extracts readable page copy while skipping controls and voice UI', () => {
    const root = document.createElement('main');
    root.innerHTML = `
      <h1>D3VONN.IO</h1>
      <p>Enterprise intelligence for governed operations.</p>
      <button>Delete everything</button>
      <nav><p>Navigation copy</p></nav>
      <div data-voice-skip><p>Reader controls</p></div>
      <section><h2>Capabilities</h2><p>Deploy agents safely.</p></section>
    `;

    expect(extractReadablePageText(root)).toBe([
      'D3VONN.IO',
      'Enterprise intelligence for governed operations.',
      'Capabilities',
      'Deploy agents safely.',
    ].join('\n'));
  });

  it('deduplicates repeated rendered content', () => {
    const root = document.createElement('main');
    root.innerHTML = '<p>Same copy</p><p>Same copy</p><p>Different copy</p>';
    expect(extractReadablePageText(root)).toBe('Same copy\nDifferent copy');
  });

  it('keeps every TTS chunk below the backend request limit', () => {
    const source = Array.from({ length: 60 }, (_, index) =>
      `Paragraph ${index}. This sentence contains enough readable content to exercise chunk splitting.`
    ).join('\n');

    const chunks = chunkReadableText(source, 300);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 300)).toBe(true);
    expect(chunks.join(' ')).toContain('Paragraph 59.');
  });
});
