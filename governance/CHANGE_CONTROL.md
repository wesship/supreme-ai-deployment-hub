# Change Control Policy

After `v1.0-prod-lock`, the following changes require formal approval.

## Locked surfaces

| Surface | Approval required | Reviewer |
|---|---|---|
| `.github/workflows/**` | PR + sign-off | @core-platform |
| `supabase/migrations/**` | PR + sign-off | @core-platform + @data |
| `governance/**` | PR + 2 reviewers | @core-platform + @security |
| Branch protection on `main` | GitHub admin only | @core-platform lead |
| Required status checks | Edit `REQUIRED_CHECKS.md` first | @core-platform + @security |
| Secrets (rotation, addition, deletion) | Ticket + audit log | @security |

## Drift detection

- `governance/workflow-fingerprints.txt` is regenerated nightly and compared.
  Any diff opens an automatic issue tagged `governance-drift`.
- Supabase linter runs on every PR; new findings must be either fixed or
  added to `SECURITY_ACCEPTANCE.md` with justification.

## Emergency override

Production incidents may bypass review with:
1. Incident commander declares INC-### in `#incidents`
2. Single-reviewer hotfix merge allowed for ≤4 hours
3. Post-mortem within 48 hours, retroactive review of bypassed PR

## Release cadence

- Patch releases: rolling, behind required checks
- Minor releases: weekly, tagged Friday
- Major releases: monthly, requires changelog + migration guide
