import type { Point } from './gestureEngine';
export interface Tracker { detectForVideo(video: HTMLVideoElement, now: number): { landmarks: Point[][] }; close(): void }
export async function createTracker(): Promise<Tracker> {
  const canvas = document.createElement('canvas');
  if (!canvas.getContext('webgl2')) throw new Error('Hand tracking needs WebGL 2. Try a supported browser with hardware acceleration enabled.');
  const url = '/holo/vendor/vision_bundle.mjs';
  const vision = await import(/* @vite-ignore */ url);
  const files = await vision.FilesetResolver.forVisionTasks('/holo/vendor/wasm');
  const options = { runningMode: 'VIDEO', numHands: 2, baseOptions: { modelAssetPath: '/holo/vendor/hand_landmarker.task', delegate: 'GPU' } };
  try { return await vision.HandLandmarker.createFromOptions(files, options); }
  catch { return await vision.HandLandmarker.createFromOptions(files, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } }); }
}
