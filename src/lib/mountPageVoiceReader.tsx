import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/** The canonical shell owns this reader; the approved homepage hides it. */
export function mountPageVoiceReader(): void {
  // Strict Mode and returning from the public entry must reuse the same root.
  if (document.getElementById('page-voice-reader-root')) return;
  const element = document.createElement('div');
  element.id = 'page-voice-reader-root';
  element.setAttribute('data-voice-skip', 'true');
  document.body.appendChild(element);
  void import('../components/accessibility/PageVoiceReader')
    .then(({ default: PageVoiceReader }) => {
      createRoot(element).render(<StrictMode><PageVoiceReader /></StrictMode>);
    })
    .catch((error) => console.error('[D3VONN] Page voice reader failed to load:', error));
}
