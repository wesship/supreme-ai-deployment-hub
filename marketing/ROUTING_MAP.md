# Marketing Routing Map

## Routes

```yaml
generate_social_post:
  owner: marketing-agent
  reviewers:
    - brand-agent
    - compliance-agent

generate_email:
  owner: marketing-agent
  reviewers:
    - brand-agent
    - compliance-agent

generate_launch_campaign:
  owner: launch-agent
  reviewers:
    - marketing-agent
    - brand-agent
    - compliance-agent

prepare_channel_asset:
  owner: publisher-agent
  requires_human_approval: true

analyze_campaign:
  owner: analytics-agent
  reviewers:
    - marketing-agent

research_trends:
  owner: research-agent
  reviewers:
    - marketing-agent
```

## Route Philosophy

- Marketing Agent drafts.
- Brand Agent improves fit and voice.
- Compliance Agent checks claims.
- Launch Agent packages multi-channel campaigns.
- Publisher Agent prepares channel-ready output.
- Analytics Agent creates feedback loops.
- Research Agent feeds timely opportunities back into the system.
