# Music Workbench dependencies

| Project | Version integrated | Code license | Implementation |
| --- | --- | --- | --- |
| WaveSurfer.js | 8.0.2 | BSD-3-Clause | Local waveforms, region selection, beat overlays |
| Tone.js | 15.1.22 | MIT | Drum sequencer, synth melody audition |
| librosa | 0.11.0 | ISC | Tempo, beat positions, chroma-based key estimate |
| Spotify Basic Pitch | 0.4.0 | Apache-2.0 | Original MIDI and note JSON artifacts |
| Python Audio Separator | 0.47.0 | MIT | Operator-selected alternative separation model |
| WhisperX | 3.8.6 | BSD-2-Clause | Aligned transcript, word timing, text/SRT; optional diarization |
| DeepFilterNet | 0.5.6 | MIT or Apache-2.0 | Mono speech cleanup adapter |
| pyloudnorm | 0.2.0 | MIT | LUFS measurement and gain-only normalization |

Upstream sources:

- https://github.com/katspaugh/wavesurfer.js
- https://github.com/Tonejs/Tone.js
- https://github.com/librosa/librosa
- https://github.com/spotify/basic-pitch
- https://github.com/nomadkaraoke/python-audio-separator
- https://github.com/m-bain/whisperX
- https://github.com/Rikorose/DeepFilterNet
- https://github.com/csteinmetz1/pyloudnorm

Keep the upstream license and notice files with shipped packages. This table
records code licenses; selected model/checkpoint terms and optional pyannote
access requirements must be checked separately before model qualification.
No LALAL.AI code, branding assets, private endpoints, or weights are included.
