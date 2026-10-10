import { readFileSync } from 'node:fs';

const html = readFileSync('public/glasses/index.html', 'utf8');
const script = readFileSync('public/glasses/glasses.js', 'utf8');
const docs = readFileSync('docs/wearables/D3VONN_RAYBAN_DISPLAY.md', 'utf8');

describe('wearable display preview safety boundary', () => {
  it('keeps executable code external for the production CSP', () => {
    expect(html).toContain('<script src="/glasses/glasses.js" defer></script>');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toContain('<style>');
  });

  it('does not write wearable events or persist browser data', () => {
    expect(script).not.toContain('fetch(');
    expect(script).not.toContain('localStorage');
    expect(script).not.toContain('sessionStorage');
    expect(script).not.toContain('/api/v1/vision/events');
  });

  it('states that hardware and backend actions remain certification-gated', () => {
    expect(html).toContain('Local preview only');
    expect(html).toContain('No device or backend action is sent.');
    expect(docs).toContain('No Meta partnership, device support, or physical Ray-Ban certification is claimed');
  });

  it('executes keyboard navigation and local action feedback', () => {
    document.documentElement.innerHTML = html;
    window.eval(script);

    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));
    buttons[0].focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(document.activeElement).toBe(buttons[1]);

    buttons[1].click();
    expect(document.querySelector('[data-message]')?.textContent).toBe('HNF Radio preview');
    expect(document.querySelector('[data-detail]')?.textContent).toContain('Playback is not started');

    buttons[2].click();
    expect(document.querySelector('[data-message]')?.textContent).toBe('PRIMETIME preview');
    expect(document.querySelector('[data-detail]')?.textContent).toContain('No media or workflow was queued');
  });
});
