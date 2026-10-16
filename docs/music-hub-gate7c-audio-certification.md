# Music Hub Gate 7C — Audio QA certification record

Status: **NOT CERTIFIED — HOLD**. This document defines evidence collection, not evidence of completed browser tests.

## Deterministic fixtures
Generate uncompressed WAV test files using any trusted signal generator, and retain hashes:
1. Mono 1 kHz sine, 48 kHz, 5 seconds, peak 0.5.
2. Stereo left-only impulse and right-only impulse, 44.1 kHz, 2 seconds.
3. Stereo antiphase sine (L = -R), 44.1 kHz, 5 seconds.
4. Digital silence, 44.1 kHz, 3 seconds.
5. Over-ceiling mix: aligned 1 kHz signals whose combined peak exceeds 0.98.
6. Different-duration stems (3 seconds and 5 seconds); document current shortest-duration export policy.
7. Different sample-rate stems (44.1 kHz and 48 kHz) to test resampling.

## Audio acceptance
- Parse **downloaded** RIFF/WAVE files independently. Verify PCM16, two output channels, 44,100 Hz, block align 4, and data size matching output frames.
- Peak decoded PCM amplitude <= 0.98 + 1/32768, for finite inputs.
- Silence remains silent; quiet signals are not boosted; louder mixes are attenuated by a shared scale.
- Left-only and right-only inputs stay in the intended channel; antiphase does not collapse or invert unexpectedly.
- Export duration equals the shortest loaded stem duration within one output sample.
- Compare playback and exported WAV for mute/solo/gain settings; verify seeking and pause/resume.
- Listen with headphones for clicks, distortion, channel imbalance and timing offsets.

## Browser/device matrix
| Browser | Device | Version | Fixture results | Export artifact | Peak memory | Outcome |
|---|---|---|---|---|---|---|
| Chrome | Desktop | TBD | TBD | TBD | TBD | Pending |
| Firefox | Desktop | TBD | TBD | TBD | TBD | Pending |
| Safari | macOS | TBD | TBD | TBD | TBD | Pending |
| Safari | iPhone | TBD | TBD | TBD | TBD | Pending |
| Chrome | Android | TBD | TBD | TBD | TBD | Pending |

Run repeated load/export cycles, large files, interruption/background/foreground, and invalid/corrupt inputs. Record memory snapshots, device limits, browser errors and failures. Note that 100 MB per compressed input does **not** cap decoded AudioBuffer RAM; offline rendering and WAV output add further allocations.

## Known product limits
Sample-peak scaling is not true-peak limiting or loudness mastering. Waveform preview currently samples channel 0 only. The mixer truncates to the shortest stem. Do not enable AI separation providers as part of this gate.

## Release criteria
All required browser rows must be filled with reproducible artifacts and pass; no unresolved audio integrity or mobile memory blocker; latest CI and security checks green. PR remains draft and feature disabled until human review and explicit release approval.
