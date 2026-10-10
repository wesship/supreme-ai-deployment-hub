# D3VONN Music Hub multi-provider registry

This branch introduces a deny-by-default provider registry for Music Hub.

## Providers

- `ace-step-1.5`: default generation candidate using `ACE-Step/Ace-Step1.5` (MIT).
- `ace-step-1.5-xl-turbo`: premium candidate using `ACE-Step/acestep-v15-xl-turbo-diffusers` (MIT).
- `heartmula-oss-3b`: secondary lyrics/style candidate using `HeartMuLa/HeartMuLa-oss-3B` (Apache-2.0).

## Activation rules

All providers remain disabled until the exact source revision, model revision, production weight hashes, deployment target, and human approval record are captured. Hosted and commercial flags must remain false until qualification and smoke testing complete.

Auto-routing remains disabled until at least two providers are independently qualified.

## Intended routing

- Default / fast / editing: ACE-Step 1.5
- Premium / highest-quality: ACE-Step 1.5 XL Turbo
- Lyrics / multilingual / style control: HeartMuLa OSS 3B

## Runtime contract

The Music Hub runtime must select only enabled providers, snapshot the selected provider policy onto every job before dispatch, reject jobs when policy is incomplete, and never let later registry edits rewrite a historical job's compliance snapshot.

Every successful generation must pass the audio-QA/mastering pipeline before entering the private music library.

## Next qualification gate

For each provider:

1. Pin source commit.
2. Pin Hugging Face model revision.
3. Inventory all production weight files and hashes.
4. Verify dependency licenses.
5. Record hardware baseline and benchmark.
6. Deploy to a private GPU endpoint.
7. Run controlled generation smoke tests.
8. Run audio QA and mastering.
9. Record reviewer and timestamp.
10. Enable the provider only after all previous steps pass.
