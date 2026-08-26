# D3VONN AI Films — Local Open Video Worker

The Alpha supports self-hosted Wan and LTX through explicit runner commands. The API does not import model-specific GPU dependencies; GPU workers own those environments.

## Environment

```text
D3VONN_WAN_VIDEO_RUNNER=/opt/d3vonn/bin/wan-video
D3VONN_WAN_VIDEO_MODEL=Wan2.2-TI2V-5B
D3VONN_LTX_VIDEO_RUNNER=/opt/d3vonn/bin/ltx-video
D3VONN_LTX_VIDEO_MODEL=LTX-2
```

The runner contract is:

```text
--model MODEL --prompt PROMPT --output OUTPUT
--width WIDTH --height HEIGHT --fps FPS --duration SECONDS
[--input-image PATH] [--seed SEED]
```

The wrapper can internally call ComfyUI, Wan2.2, LTX, or another operator-approved local runtime. This keeps D3VONN's film graph model-agnostic.

## Production rule

Do not download or bundle checkpoints automatically from the API. Operators must obtain checkpoints under their applicable licenses and configure the runner explicitly.

## Alpha acceptance

A configured worker must create a non-empty video file at the requested output path. Failed commands and missing output are surfaced as retryable worker errors.
