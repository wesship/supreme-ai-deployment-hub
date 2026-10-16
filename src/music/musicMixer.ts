export type AudioStem = { id: string; name: string; buffer: AudioBuffer; muted: boolean; solo: boolean; gain: number };
export const stemGain = (stem: Pick<AudioStem, 'muted' | 'solo' | 'gain'>, anySolo: boolean) =>
  stem.muted || (anySolo && !stem.solo) ? 0 : stem.gain;
export const encodeWav = (channels: Float32Array[], sampleRate: number): Blob => {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0 || sampleRate > 192000) throw new RangeError('Unsupported WAV sample rate');
  if (channels.length < 1 || channels.length > 2) throw new RangeError('WAV export requires mono or stereo channels');
  const frames = channels[0].length;
  if (!frames || channels.some(channel => channel.length !== frames)) throw new RangeError('WAV channels must have identical nonzero lengths');
  if (44 + frames * 2 * channels.length > 250 * 1024 * 1024) throw new RangeError('WAV export exceeds size limit');
  const output = new ArrayBuffer(44 + frames * 2 * channels.length);
  const view = new DataView(output);
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  ascii(0, 'RIFF'); view.setUint32(4, output.byteLength - 8, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, frames * channels.length * 2, true);
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels.length; c++) {
    if (!Number.isFinite(channels[c][i])) throw new RangeError('Audio contains non-finite samples');
    const value = Math.max(-1, Math.min(1, channels[c][i]));
    view.setInt16(44 + (i * channels.length + c) * 2, value < 0 ? value * 32768 : value * 32767, true);
  }
  return new Blob([output], { type: 'audio/wav' });
};

export const measurePeak = (channels: Float32Array[]) => {
  let peak = 0;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) {
    if (!Number.isFinite(channel[i])) throw new RangeError('Audio contains non-finite samples');
    peak = Math.max(peak, Math.abs(channel[i]));
  }
  return peak;
};
export const safeMixScale = (peak: number, ceiling = 0.98) => {
  if (!Number.isFinite(peak) || peak < 0 || !Number.isFinite(ceiling) || ceiling <= 0 || ceiling > 1) throw new RangeError('Invalid peak or ceiling');
  return peak > ceiling ? ceiling / peak : 1;
};
export const waveformBars = (buffer: AudioBuffer, count = 64): number[] => {
  const samples = buffer.getChannelData(0);
  const size = Math.max(1, Math.ceil(samples.length / count));
  return Array.from({ length: count }, (_, x) => {
    let peak = 0;
    for (let i = x * size; i < Math.min(samples.length, (x + 1) * size); i++) peak = Math.max(peak, Math.abs(samples[i]));
    return Math.min(1, peak);
  });
};

export interface MixerInput { id: string; name: string; buffer: AudioBuffer }
export interface MixerSession { id: string; label: string; stems: MixerInput[] }
export const MIXER_MAX_TRACKS = 8;
export const MIXER_MAX_MEMORY = 128 * 1024 * 1024;

export function validateMixerInputs(inputs: MixerInput[]): void {
  if (!inputs.length || inputs.length > MIXER_MAX_TRACKS || new Set(inputs.map(input => input.id)).size !== inputs.length) throw new RangeError('Load between one and eight distinct stems.');
  let bytes = 0;
  for (const { buffer } of inputs) {
    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 600 || ![1, 2].includes(buffer.numberOfChannels)) throw new RangeError('Use mono/stereo recordings up to 10 minutes.');
    bytes += buffer.length * buffer.numberOfChannels * 4;
  }
  if (!Number.isFinite(bytes) || bytes > MIXER_MAX_MEMORY) throw new RangeError('Decoded stems exceed the 128 MiB mixer limit. Use shorter recordings.');
}

export async function metadataDuration(file: File, signal: AbortSignal): Promise<number> {
  const url = URL.createObjectURL(file);
  const audio = new Audio();
  audio.preload = 'metadata';
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void;
  try {
    return await new Promise<number>((resolve, reject) => {
      abort = () => reject(new Error('Audio load cancelled'));
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => reject(new Error('Audio metadata timed out')), 15000);
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => reject(new Error('Audio metadata could not be read'));
      if (signal.aborted) abort(); else audio.src = url;
    });
  } finally {
    clearTimeout(timer!); signal.removeEventListener('abort', abort!);
    audio.onloadedmetadata = null; audio.onerror = null;
    audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url);
  }
}

