# Needle glasses intent prototype

This is an isolated, **proposal-only** edge experiment. It does not connect a camera, execute a local action, call the D3VONN API, or authorize a GUARDIAN request. `guardian_review` means human approval is still required in the authoritative gateway; this router cannot grant it. Unknown calls, unexpected arguments, low or missing confidence, and multiple calls fail closed.

On the Jetson Orin Nano with a supported Python version, install `cactus-needle` in a dedicated environment and cache the generation 2 engine with `needle fetch --generation 2`. For offline use, set `HF_HUB_OFFLINE=1` after caching. See the [upstream API](https://github.com/cactus-compute/needle/blob/main/doc/apis.md) for platform tags and engine paths. Keep this dependency out of the production frontend and backend requirements.

From the repository root:

```python
from edge.needle.router import propose
print(propose("take a picture"))
```

Run the policy checks with `python -m unittest discover -s edge/needle/tests`. Before device deployment, add an authenticated device adapter and explicit D3VONN gateway contract, then measure intent accuracy and latency on real glasses commands. The twelve declared commands engage Needle's top-five tool retrieval; validate retrieval against the intended utterances before trusting it for device actions. The confidence threshold is provisional, not a measured safety guarantee.

Run `python -m edge.needle.evaluate` on a machine with Needle installed and its engine cached. The 16-case acceptance suite prints per-utterance proposed tool, route, confidence, and latency as JSON and exits successfully only at 90% accuracy with zero critical failures. The suite uses `complete()` only: it never executes a proposed command. Compare outcomes on the Orin with real voice transcripts before integrating any device adapter.

On a local x86_64 test with `cactus-needle==2.0.13`, the suite passed 15/16 cases with zero unsafe dispatches. Needle refused `send money` instead of producing a GUARDIAN review proposal, a safe but incorrect intent match. Initial testing also found that `do not start recording` produced a high-confidence `stop_recording` call; the deterministic negation guard now escalates that transcript before action routing. This small text suite is not evidence of reliability on live audio, Jetson hardware, or against paraphrased adversarial requests. Keep the device adapter disabled until broader on-device acceptance testing.
