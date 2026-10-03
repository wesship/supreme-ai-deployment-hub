# D3VONN.IO — Spatial Workspace Prompt Pack

Original D3VONN templates for Apple Vision Pro, XREAL display glasses and monitors. This is not an import of AI Workshop's or Holo Gestures' paid/private prompt pack.

## How to use

Open /holo and choose the display mode. Prompts below are requests to paste or speak in your existing Hermes conversation; they do not install tools, control the browser automatically or authorize execution. Tool availability and authentication determine what Hermes can do. Ask for a plan first, review the proposed actions and use existing approval controls for execution. Local notes are never included automatically: only share text with Hermes if you explicitly intend to send it.

## Apple Vision Pro

Open https://d3vonn.io/holo?display=vision-pro in Safari on the headset. Enlarge the window. Look at a card/button, then tap thumb and index finger together to select it. The always-visible card selector and zoom buttons provide alternatives to card dragging. Camera tracking controls are hidden in this mode. It is a Safari browser window, not an immersive WebXR scene or a native visionOS app. Physical headset acceptance remains unverified.

For Mac Virtual Display: open Monitor mode on your Mac and use the Mac webcam if you want MediaPipe hand tracking. The selected host camera must actually see your hands; the headset cameras are not paired with this site.

## XREAL and monitor

Connect the display to a compatible host video output. For XREAL, use a host with USB-C DisplayPort video output. Move the browser onto the display, choose XREAL or Monitor, enter fullscreen and explicitly start the selected webcam. Mirror a selfie-facing camera; disable mirroring for a forward camera. Hold peace to reset; two open palms arrange; two pinches pan/zoom/rotate. Keyboard and pointer remain available.

## Starter prompts

1. **Daily briefing** — "Hermes, give me a concise briefing using the live tools available to my signed-in account. Include timestamps and sources. Label unavailable information; do not fill gaps with demo numbers."
2. **Three priorities** — "Given the goals I explicitly provide, propose three priorities for today. State the expected outcome, required input and next review point. Do not execute anything."
3. **Workflow plan** — "Turn this goal into a workflow proposal: [goal]. List dependencies, tools, costs if known, checkpoints and actions requiring approval. Return the plan for review."
4. **Agent delegation** — "Recommend available specialists for [task]. Explain each role and the handoff. Report if no suitable connected agent exists. Do not spawn or run agents yet."
5. **Task status** — "Use authorized tools to check [task ID]. Report its latest state, evidence timestamp, blocker and next action. If the tool is unavailable, tell me what input is needed."
6. **Knowledge trace** — "Trace the evidence for [claim/topic] using my authorized knowledge sources. Show source links and uncertainty. Separate sourced facts from your interpretation."
7. **Meeting preparation** — "Prepare a briefing for [meeting] from the material I explicitly share. Give me the objective, decisions, open questions and a five-minute agenda."
8. **Decision comparison** — "Compare [options] against [constraints]. Use a compact table and disclose assumptions. Recommend a next step without making purchases or sending messages."
9. **Film planning** — "Draft a production plan for [film concept]. Include story beats, shot list, assets, rights questions and review stages. Do not trigger paid generation."
10. **Voice production** — "Draft a voice script for [audience/purpose]. Suggest pacing and pronunciation notes. Wait for approval before a provider generation request."
11. **Platform health** — "Check the service health tools available to me. Distinguish live observations from unavailable services and give the evidence timestamp. Do not change configuration."
12. **End-of-session handoff** — "Summarize this conversation into decisions, evidence, open tasks and the next review point. Save it only if an authorized storage tool is available and I approve the destination."

## Device-help prompts

13. **Vision Pro orientation** — "Explain how to use the D3VONN Safari window on Vision Pro. Cover native look-and-pinch selection, the card selector, window resizing and voice activation. Do not imply immersive WebXR or access to headset cameras is implemented."
14. **XREAL orientation** — "Walk me through host display output, OS extend/mirror, browser placement, fullscreen, selected webcam and audio settings for this XREAL workspace. Ask for my device model if a hardware-specific step is needed."
15. **Camera troubleshooting** — "Help me diagnose [camera error] in the host-webcam mode. Check HTTPS, explicit permission, selected device, browser WebGL 2 and hardware acceleration. Do not ask for private camera recordings."
16. **Voice troubleshooting** — "Help diagnose [voice error]. Check sign-in, microphone permission and configured provider availability. Never ask me to paste access tokens or private API keys."

## UI actions are separate

Select a card and choose Open to navigate to Hermes workflows, Knowledge graph, Agents, Film Studio, Voice Studio or Mission control. Prompt text does not guarantee voice navigation. Use Import local note for plain text .txt/.md files up to 64 KB; at most 20 notes remain in memory only. Downloading or importing this pack does not run its prompts.

## Acceptance limits

These are original request templates, not claims that every suggested backend tool is installed or connected. Signed-in provider execution and real glasses/hand accuracy require device testing. No native Vision Pro sensor pairing, WebXR session, spatial anchoring or 6DoF is supplied by Safari window mode.

Official references:
- https://support.apple.com/117741
- https://support.apple.com/guide/apple-vision-pro/tan714802d1a/visionos
- https://webkit.org/blog/15162/introducing-natural-input-for-webxr-in-apple-vision-pro/
