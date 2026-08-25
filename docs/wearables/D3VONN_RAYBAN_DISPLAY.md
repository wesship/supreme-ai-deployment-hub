# D3VONN Ray-Ban Display

The `/glasses/` static Web App is the first lightweight Display surface for D3VONN. It is intentionally independent of the full operator dashboard so the wearable can load a small, deterministic 600x600 experience.

## UX

- dark/additive-display friendly canvas
- large glanceable typography
- shallow action list
- keyboard arrow/Enter controls for browser simulation
- actions for D3VONN, HNF Radio, PRIMETIME and notifications

## Security

The Web App contains no privileged credentials. The API base is supplied as a public origin only; authenticated backend authorization and consent checks remain server-side. Do not place Supabase service-role keys or provider secrets in browser-exposed variables.

## Deployment

1. Deploy the repository to HTTPS.
2. Register the wearable project in Meta's Wearables Developer Center.
3. Configure the Display Web App URL to the deployed `/glasses/` path.
4. Test navigation and readability on physical Ray-Ban Display hardware.
5. Integrate the D3VONN Wearable OS backend/Meta adapter before enabling authenticated production actions.

Meta's wearable platform is a developer-preview surface and capabilities can change. Physical-device certification remains a required release gate.
