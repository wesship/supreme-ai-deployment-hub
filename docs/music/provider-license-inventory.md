# Music provider license inventory

This inventory records the provider-level licensing facts verified during qualification. It is not a substitute for reviewing every transitive dependency shipped in the final runtime image.

## ACE-Step 1.5

- Provider/model license: MIT
- Source repository: `ace-step/ACE-Step-1.5`
- Pinned source revision: `ca1e85fe9430179831e6bc6be790c332190a3866`
- Pinned model revision: `19671f406d603126926c1b7e2adc169acbcade22`
- Bundled Qwen3 embedding component requires separate dependency-license confirmation in the final runtime image.
- Final dependency review status: pending

## ACE-Step 1.5 XL Turbo Diffusers

- Provider/model license: MIT
- Pinned source revision: `ca1e85fe9430179831e6bc6be790c332190a3866`
- Pinned model revision: `200ba991ae448051e14b0183157e35c2d27c9fb0`
- Runtime depends on Diffusers/Transformers/Accelerate and associated model components; final container SBOM/license scan is required.
- Final dependency review status: pending

## HeartMuLa OSS 3B

- Provider/model license: Apache-2.0
- Pinned source revision: `3783bdb8441f2c298b1e64c8651173aac200361c`
- Pinned model revision: `d12ac79c6b3387d5c9eee456323495d8f08bb09d`
- HeartCodec and any other runtime model dependencies must be pinned and reviewed separately before activation.
- Final dependency review status: pending

## Activation invariant

No provider may move to approved/enabled while its final runtime dependency inventory is incomplete. The production image, not only the top-level model card, is the unit that must pass license review.
