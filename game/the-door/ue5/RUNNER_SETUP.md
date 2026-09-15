# Gate 107 self-hosted runner setup

Gate 107 requires a Windows x64 self-hosted GitHub Actions runner with Unreal Engine 5.3 installed.

Required labels:

- `self-hosted`
- `Windows`
- `X64`
- `ue5-3`

Expected UE path by default:

`C:\Program Files\Epic Games\UE_5.3`

Before registering the runner, execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\game\the-door\ue5\SetupGate107Runner.ps1
```

Expected result:

`RUNNER_READY=YES`

Then configure a repository self-hosted runner from GitHub Settings > Actions > Runners and add the custom `ue5-3` label.

Security rule: never commit or paste the temporary GitHub runner registration token into the repository, PR, logs, or chat. Use it only during runner registration on the Windows host.

Once the runner is online, PR #1234's `The Door Gate 107 - Unreal 5.3 Evidence` workflow can execute the exact source bundle, compile `DEVONN_AIEditor`, run `TheDoor.Retro`, and upload evidence.

A queued, skipped, or waiting-for-runner workflow is not Gate 107 certification.
