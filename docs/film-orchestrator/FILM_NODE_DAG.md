# D3VONN.IO AI Films Film Node DAG

Canonical shot flow: generate -> continuity QC -> ACES/OCIO color conform -> composite -> neural upscale -> OTIO editorial -> master -> final QC.

Audio branches after continuity QC and rejoins at editorial.

Defaults: 2048x1080 working resolution, 3840x2160 delivery, ACEScg working space, OpenEXR master container, HALF RGB, FLOAT depth, adaptive upscaling.

Hermes states: pending, queued, running, retrying, blocked, approved, failed, completed.

Generation providers remain interchangeable so Kling, OpenAI video, MovieFlow, ComfyUI, Unreal, and future providers can feed the same downstream finishing pipeline.
