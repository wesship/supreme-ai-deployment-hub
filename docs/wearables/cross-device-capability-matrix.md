# D3VONN Cross-Device Capability Matrix

| Capability | Ray-Ban Display | Apple Vision Pro | D3VONN Web | Server/Agent |
|---|---|---|---|---|
| AI assistant | Yes | Yes | Yes | Yes |
| Notifications | Yes | Yes | Yes | Yes |
| PRIMETIME control | Yes | Yes | Yes | Yes |
| HNF Radio | Yes | Yes | Yes | Yes |
| Workflow status | Yes | Yes | Yes | Yes |
| Approval requests | Yes | Yes | Yes | Yes |
| Camera/vision events | Adapter-dependent | Native visionOS path | Browser-dependent | Yes |
| Spatial/3D UI | Display UI | Yes | Limited | N/A |
| Neural Band | Yes | N/A | N/A | N/A |
| Hand/eye spatial input | Limited by wearable platform | Yes | Browser/platform dependent | N/A |
| Offline local AI | Through supported edge path | Through supported edge path | Limited | Yes |

## Principle

All clients consume the same authenticated D3VONN capability APIs. Device-specific features remain behind adapters. This prevents a vendor-specific UI from becoming the source of authorization truth.
