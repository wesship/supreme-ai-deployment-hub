# Music provider compliance gate

Music providers are deny-by-default for hosted or commercial generation until the exact implementation is reviewed.

## Required approval record

A provider may only dispatch when all of these are present and approved:

- source repository and exact revision
- model identifier and exact revision
- weights/checkpoint hash
- dependency/license inventory
- deployment mode (local or hosted)
- commercial generation approval
- commercial output approval
- required attribution/provenance
- review timestamp and reviewer

## ACE-Step policy

ACE-Step remains disabled for hosted/commercial dispatch until the exact source, model/weights, dependencies, and applicable terms are reconciled. The upstream repository currently states MIT licensing, while individual files can carry different licenses; for example, an ACE-Step base-model implementation file is Apache-2.0. Do not infer the license of every component from the repository-level license.

## CI invariant

A provider configuration must fail validation when `hosted_allowed` or `commercial_output_allowed` is enabled without a pinned revision/hash and explicit approval metadata.

## Runtime invariant

The runtime must evaluate the stored provider policy and the per-job license snapshot before dispatch. Configuration changes must not retroactively change the compliance record attached to an existing job.
