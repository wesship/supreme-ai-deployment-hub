# Claim Check Prompt

Review this D3VONN.IO content for claim safety.

## Check Against

- `marketing/data/approved-claims.md`
- `marketing/data/prohibited-claims.md`
- `marketing/data/metrics-source-of-truth.md`

## Output

Return:

- APPROVE, REVISE, or BLOCK
- Claims found
- Risk level
- Suggested safer wording
- Required verification sources

## Default Rule

If a claim is exact, sensitive, or compliance-related and no source is available, mark it REVISE or BLOCK.
