# XREAL / monitor setup

1. Connect your glasses to a host with USB-C DisplayPort video output, or connect an external monitor with its supported cable. A USB-C charging-only port cannot carry the display.
2. Extend or mirror the display using your operating system.
3. Open the deployed `/holo?display=xreal` route and move the browser to that display.
4. Select XREAL / display glasses and Enter fullscreen. Escape exits fullscreen.
5. Click Find cameras, select the host webcam, and Start hand tracking. Allow camera permission when prompted. Use a WebGL-2-enabled browser with hardware acceleration.
6. Use mirroring for a selfie-facing camera. Turn it off for a forward-facing camera; restart tracking after changing it.
7. Choose your microphone/speaker in OS settings, sign in to D3VONN for authenticated Hermes tools, and start the existing voice control.

Pinch to drag. Quick pinch selects. Two simultaneous pinches zoom, pan and rotate. Hold peace for 800 ms to reset; hold two open palms to arrange. Pointer/touch and keyboard are alternatives.

This browser uses the selected webcam, not native glasses cameras, inertial sensors or 6DoF. Frames and imported notes stay on the host. Voice is a separate explicit provider session. Real glasses and hand accuracy still require physical-device acceptance testing.

Official hardware documentation: https://www.xreal.com/one-pro
Native SDK documentation: https://docs.xreal.com/Getting%20Started%20with%20XREAL%20SDK
