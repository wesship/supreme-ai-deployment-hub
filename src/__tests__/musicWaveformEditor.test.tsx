import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MusicWaveformEditor from '../music/MusicWaveformEditor';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('MusicWaveformEditor preview gate', () => {
  it('does not enable playback without a selected recording', () => {
    render(<MusicWaveformEditor />);
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('slider', { name: 'Seek position' }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('No recording selected')).toBeTruthy();
  });

  it('rejects a non-audio file before decoding or uploading', () => {
    render(<MusicWaveformEditor />);
    const file = new File(['not audio'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Choose audio file'), { target: { files: [file] } });
    expect(screen.getByRole('alert').textContent).toContain('Choose an audio file under 100 MB');
    expect(screen.getByText('No recording selected')).toBeTruthy();
  });

  it('allows the region-loop control to be toggled independently of playback', () => {
    render(<MusicWaveformEditor />);
    const checkbox = screen.getByRole('checkbox', { name: 'Loop selected region' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });
});
