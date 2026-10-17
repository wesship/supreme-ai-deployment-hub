# D3VONN.IO The Door — Adinkra Narrative System

Status: SCAFFOLDED. This document defines implementation intent; cultural review and UE5 runtime evidence are still required before certification.

## Design rule

Adinkra symbols are not treated as generic occult decoration. Their documented Ghanaian/Akan cultural meanings remain explicit in data, while gameplay uses them as recurring narrative motifs, memory anchors, choice signals, and cross-world connective tissue.

## Placement through the game

- **Accra / Ghana** — primary teaching context. The player first learns names and meanings here from grounded cultural context.
- **Doors** — selected symbols may appear as subtle markings only after the player has encountered them legitimately.
- **GodEye** — discovered symbols can annotate world nodes and reveal relationships between otherwise distant locations.
- **Ancient Threshold worlds** — symbols appear as Door-system echoes or interpretive overlays, not as claims that Ghanaian symbols historically existed at those archaeological sites.
- **UI / save-memory** — Sankofa can mark recoverable memories and abandoned narrative branches.
- **Branching narrative** — Gnosis can reveal deeper interpretations or choice variants tied to a symbol's gameplay role.
- **Door Realm** — the symbols can recur as cross-world motifs, but their real cultural meaning must remain distinguishable from fictional Door-system behavior.

## Initial gameplay mapping

- Sankofa — memory, return, recover what was left behind.
- Gye Nyame — destiny / spiritual endurance; late-game use only and never reduced to a power-up icon.
- Dwennimmen — strength with humility; restraint and non-violent choices.
- Nkyinkyim — adaptability and the twisting path; branching-world navigation.
- Fawohodie — independence/freedom; liberation from imposed timelines.
- Aya — endurance/resilience; survival after world collapse.
- Adinkrahene — leadership and unification; reconciling world branches.
- Ananse Ntontan — wisdom, creativity, complexity, and the hidden network connecting Doors.

## Truth boundary

Any archaeological or alternate-world appearance outside Ghana is fictional narrative design. The game must not present such placement as real historical evidence.

## Next runtime gate

1. Compile `AdinkraSymbolTypes` and `UAdinkraSymbolSubsystem` under UE5.3.
2. Run `TheDoor.WorldForge.Adinkra.NarrativeContract`.
3. Add save serialization for `FAdinkraDiscoveryState`.
4. Add one in-world interaction actor and one GodEye annotation example.
5. Perform cultural review before final art/iconography is locked.
