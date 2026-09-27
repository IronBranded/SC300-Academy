# Changelog

Notable changes to SC300 Academy, newest first. Content corrections that change a
factual claim are listed with the module id.

## 1.0.0 - 2026-09-25

First public release, built against the SC-300 skills outline dated April 27, 2026.

- 18 modules and labs covering all 98 objectives verbatim (checked against
  `docs/SKILLS-MEASURED-SNAPSHOT.md` by `verify/outline.py`).
- Practice assessment in the format of Microsoft's free Practice Assessment: 50 randomized
  questions, practice and exam-conditions modes, rationale and Microsoft Learn links for
  every question, score report by domain and skill area.
- Practice exam (72 questions, every exam item type, case study), 134 knowledge checks,
  6 concept primers, 92-term glossary, Conditional Access evaluator, consent simulator.
- Grounding: 196 documentation links, 34 KQL queries, 70 cmdlets, 13 Azure CLI lines,
  33 facts and 190 of 206 answer explanations verified against Microsoft sources.

### Corrections made during verification

- 01-03: SAML/WS-Fed IdP federation supports Entra-verified partner domains; the
  "domain must not be verified" rule was removed. Cross-tenant sync keeps an existing
  B2B user's userType unless the mapping applies Always.
- 01-02: `AADProvisioningLogs` column is `ProvisioningAction`; the break-glass script
  uses `New-MgGroupMemberByRef`.
- 03-02: only Global Administrators approve Microsoft Graph app role requests through
  the admin consent workflow; provisioning cycles run every 20-40 minutes.
- 03-04: `OAuthAppInfo` uses `OAuthAppId`; Defender for Endpoint blocking can take up
  to three hours.
- 04-03: PIM activation maximum is 1 to 24 hours; undocumented defaults removed; PIM for
  Groups membership provisions in 2 to 10 minutes.
- 02-04, 02-02: user risk policies use Require risk remediation.
- 02-05: Entra registered devices run the Global Secure Access client in preview for
  Private Access only.
- Several threat-intelligence notes rewritten to state only what Microsoft's reports say.

### Accessibility

- Lab teardown checkboxes and the lab-run notes field now have accessible names.
- Light-theme `--cost-low` and `--status-preview` darkened to meet WCAG AA (were 4.05:1 and 3.73:1); every theme token pair is now at least 4.80:1.

### Repository

- Deploys from `main` like SC500 Academy, with Validate, Outline drift and Accessibility workflows, a project-site-aware `404.html` and an offline service worker.
