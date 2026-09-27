# SC-300 Academy

A single-page study app for **Microsoft Exam SC-300: Identity and Access Administrator**, built against the skills outline dated **April 27, 2026**, and grounded in Microsoft’s own documentation — with the checks that prove it re-running every week.

**Live site:** https://ironbranded.github.io/SC300-Academy/

## What’s inside

| | |
|---|---|
| Modules | 18 modules covering all **98 objectives** verbatim: concept, mechanism, configuration, failure modes, exam cues, KQL validation, sources, and an incident-response note |
| Labs | 18 labs with teardown steps and a cost planner; record your own successful run per lab |
| Practice assessment | **50 randomized questions** in the format of Microsoft’s free Practice Assessment: check answers as you go or sit it under exam conditions (100 minutes), rationale and Microsoft Learn links for every question, score report by domain and skill area |
| Practice exam | 72 questions in every exam format (multiple choice, multiple response, yes/no sets, build-a-list, code completion) including a case study |
| Knowledge checks | 134 questions, one per objective at minimum, feeding a Readiness view |
| Learn | 6 concept primers and a 92-term glossary |
| Interactive | Conditional Access policy evaluator, consent decision simulator |

The practice assessment follows the **shape** of Microsoft’s ([official SC-300 Practice Assessment](https://learn.microsoft.com/en-us/credentials/certifications/identity-and-access-administrator/practice/assessment?assessment-type=practice&assessmentId=60&practice-assessment-type=certification)) — its questions are Microsoft’s and are not reproduced here. Take it too.

## How the content is grounded

Every layer below is checked by a script in [`verify/`](verify/) against Microsoft’s own sources. Three workflows keep it that way:

| Workflow | When | What it does |
|---|---|---|
| [Validate](.github/workflows/validate.yml) | Every push and pull request; weekly in full | The committed `index.html` must equal what `build.sh` produces (Pages serves it directly), headless tests pass, the 98 objectives match the official outline snapshot. Weekly it also re-verifies everything below against Microsoft’s current sources and opens an issue on failure. |
| [Outline drift](.github/workflows/outline-drift.yml) | Weekly | Compares the live study guide with [`docs/SKILLS-MEASURED-SNAPSHOT.md`](docs/SKILLS-MEASURED-SNAPSHOT.md), confirms the official practice assessment is still listed, and checks the official learning paths still contain every linked training module. Opens an issue on drift. |
| [Accessibility](.github/workflows/a11y.yml) | Every push and pull request | axe-core (WCAG 2.0/2.1 A and AA plus best practice) on every page type, both themes, phone and desktop, in real Chromium; fails on any violation, JavaScript error or sideways scrolling; uploads screenshots. |

| Layer | Check | Source of truth |
|---|---|---|
| Outline (98 objectives) | Word-for-word match, 16 skill areas | Official SC-300 study guide, skills measured as of April 27, 2026 |
| Links (196) | Each Learn URL maps to a published source file, a redirect, or a live page | MicrosoftDocs repositories (entra-docs, windowsserverdocs, azure-docs, security, microsoft-365-docs, Graph docs) |
| KQL (34 queries) | Every table and column exists | Azure Monitor table reference; Defender XDR advanced-hunting schema |
| PowerShell (70 cmdlets) | Every cmdlet and parameter is documented | Graph PowerShell v1.0, Az, Exchange, SharePoint and Windows Server references |
| Azure CLI (13 lines) | Every command and flag parses | The Azure CLI itself (`--help`) |
| Facts (33) | Defaults, limits and durations match | Pinned to file and line in the Entra docs source |
| Answer keys (190 of 206) | The claim behind each answer matches | Pinned to exact sentences in Microsoft documentation |

The dated report of the first full run is in [`docs/verification-2026-09-25.md`](docs/verification-2026-09-25.md), including every correction the checks forced.

## Deploy to GitHub Pages

The site deploys straight from this repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`**. `index.html` is the whole site; `404.html` returns lost visitors to it and `sw.js` makes it work offline after the first visit.

## Work on it locally

```sh
sh build.sh                 # assemble index.html from parts/ and content/
npm install --no-save jsdom@24 && npm test   # headless tests
python3 verify/outline.py   # objectives vs the official outline snapshot
bash verify/run_all.sh      # re-verify against Microsoft sources (needs git + python3; pip install azure-cli for the CLI check)
```

Edit content in `content/` (modules `d1.js`…`d4b.js`, practice exam `exam.js`, primers `learn*.js`), run `sh build.sh`, and commit `index.html` with your change — the Validate workflow rejects a stale build. `index.html` has no external dependencies.

## Progress

Progress is saved in your browser (localStorage) on each device. When the same file runs as a claude.ai artifact it also syncs through the artifact runtime; GitHub Pages has no such runtime, so progress there is per browser.

## Known limits

- **Labs** were written from Microsoft documentation and have not been run end to end by the author; each shows *Lab run: Not yet* until you record your own run.
- **16 answer explanations** are not pinned to a single sentence (listed with reasons in the verification report).
- **Glossary definitions** were spot-checked rather than pinned one by one.
- Time-sensitive statements (Connect Sync 2.5.79.0, ID Protection risk policy retirement) switch wording automatically once their dates pass; re-verification catches anything else that changes.

## License

Code: [MIT](LICENSE). Prose, questions, diagrams and lab instructions: [CC BY 4.0](LICENSE-CONTENT). Report lab or site security problems as described in [SECURITY.md](SECURITY.md). Changes: [CHANGELOG.md](CHANGELOG.md).

Not affiliated with or endorsed by Microsoft. Microsoft Learn content is linked, not copied.
