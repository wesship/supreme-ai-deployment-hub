import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { mountPageVoiceReader } from './mountPageVoiceReader';

const { createRoot, render } = vi.hoisted(() => ({ createRoot: vi.fn(), render: vi.fn() }));
vi.mock('react-dom/client', () => ({ createRoot }));
vi.mock('../components/accessibility/PageVoiceReader', () => ({ default: () => null }));
afterEach(() => { document.getElementById('page-voice-reader-root')?.remove(); vi.clearAllMocks(); });

describe('Canonical page reader lifecycle', () => {
  it('loads one independent reader root across repeated shell mounts', async () => {
    createRoot.mockReturnValue({ render });
    mountPageVoiceReader();
    mountPageVoiceReader();
    await waitFor(() => expect(render).toHaveBeenCalledTimes(1));
    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('#page-voice-reader-root')).toHaveLength(1);
    expect(document.getElementById('page-voice-reader-root')?.dataset.voiceSkip).toBe('true');
  });
});
