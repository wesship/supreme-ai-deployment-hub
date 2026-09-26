# D3VONN.IO Security Bookmarks — Evidence-backed integration catalog

Source: user-provided Start.me screen-recording reconstruction captured 2026-09-06.

This catalog is a discovery and governance source, not a direct execution layer. Only approved APIs/data sources may be connected to Hermes. High-risk, offensive, credential, dark-web, physical-security, destructive, or malware-acquisition resources remain analyst-only or excluded from automation.

## Priority defensive integrations

1. OpenCTI — STIX/TAXII threat-intelligence graph and exchange.
2. MITRE ATT&CK — tactics/techniques normalization and mapping.
3. VirusTotal — passive file/hash/domain/URL/IP enrichment.
4. Shodan + Censys — passive internet exposure and certificate intelligence; active probing remains authorization-gated.
5. MalwareBazaar + Hybrid Analysis / CAPEv2 — malware intelligence and sandbox results.
6. Velociraptor — endpoint DFIR collection under explicit asset authorization.
7. Snort — IDS/IPS signal source.
8. OWASP ZAP / Nessus — authorized vulnerability findings only.
9. MXToolbox / IP / DNS intelligence — passive domain/email/network enrichment.
10. HaveIBeenRansom and approved breach-exposure providers — authorized exposure checks with privacy controls.

## Additional KEEP / INTEGRATE candidates

- FullHunt
- ImmuniWeb
- Malpedia
- Keycloak
- Wireshark
- Ghidra
- Wapiti
- Kasm
- Lookyloo
- Cuckoo
- Aurora Incident Response resources
- Pwndoc
- Security APIs collections
- AttackRuleMap

## Restricted / analyst-only classes

- exploit frameworks and payload collections
- credential attacks, hash cracking, password cracking and wordlists
- dark-web/hacker-forum interaction
- phishing kits and unauthorized credential collection
- malware sample acquisition outside controlled analyst workflows
- RF/wireless/physical intrusion hardware
- destructive devices
- active scanning of assets without explicit ownership/authorization

## Excluded from autonomous execution

Examples include USB Killer, Zphisher, exploit/persistence payload deployment, credential attacks, autonomous forum/dark-web interaction, destructive operations, or acquisition of unauthorized credentials.

## D3VONN routing rule

```text
Security Event
  -> Security Agent
  -> Entity extraction
  -> governed passive enrichment adapters
  -> Security Knowledge Graph
  -> MITRE ATT&CK mapping
  -> risk/confidence scoring
  -> alert/incident
  -> human approval for consequential actions
  -> response/containment/documentation
```

Start.me remains a research catalog. The Cyber Tool Registry is the control plane; Hermes must never treat bookmark presence as authorization to execute a capability.
