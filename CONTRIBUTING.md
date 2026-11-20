# Contributing to the climate taxonomy

Thank you for helping to improve the CGIAR Climate Adaptation and Mitigation Taxonomy. This page
explains how to propose a change, what happens next, and, for editors, how the vocabulary is
built, checked and released.

Everyone who takes part follows the [code of conduct](CODE_OF_CONDUCT.md).

## Proposing a change

Use a GitHub issue rather than a pull request. An issue lets the proposal be discussed and decided
before anything is edited, and it keeps the reason for every decision in one place.

Choose the form that fits ([new issue](https://github.com/Mlolita26/cgiar-climate-taxonomy/issues/new/choose)):

| Form | Use it for |
| --- | --- |
| New term | A concept the taxonomy does not have yet |
| Synonym | Another word people use for an existing term |
| Change a term | A definition, label, source, position, climate area or tagging role to correct |
| Retire a term | A term that should leave the vocabulary, or merge into another |
| Report an error | A mistake in the data, a web page or a download |

Each term page on the [web site](https://mlolita26.github.io/cgiar-climate-taxonomy/) has a
"Propose a change" button that opens the change form with the term filled in.

A good proposal has one concept, a definition with its source (IPCC, AGROVOC, FAO, WMO, UNFCCC or
a cited publication), and evidence that the term is used in CGIAR work. Add your ORCID if you have
one, so that the contribution can be credited in the release notes. If you do not have a GitHub
account, ask one of the custodians to open the issue for you.

## What happens next

The custodian screens each proposal with the five questions in [GOVERNANCE.md](GOVERNANCE.md),
answers in the issue with the decision and its reason, labels it `decided: accepted` or
`decided: refused`, and records it in [governance/decisions.csv](governance/decisions.csv).
Accepted changes are made in the master file of the taxonomy and appear in the next release.
Refused proposals stay visible so that the same question is not reopened without new evidence.

## For editors: build, check, release

The master file of the taxonomy is kept outside this repository. Its machine-readable build is
copied into `source/` (copies only; `source/SOURCES.md` records each origin and checksum).
Everything else is generated.

1. **Build.** From the repository root: `Rscript build_fair.R`. It writes `dist/` (Turtle, JSON-LD,
   CSV, relation properties), `CHANGELOG.md`, and the web site in `docs/` (home page, browser,
   downloads, releases, contributing, about, method, one page per term, and
   `docs/data/terms.json` for the search box). The settings block at the top of the script holds
   the version, licence, addresses and DOI. `docs/style.css` and `docs/site.js` are written by hand.
2. **Check.** `Rscript qa/check_skos.R`. It writes `qa/report.txt` and stops if a check fails. The
   same checks run on GitHub (workflow `QA`) whenever the vocabulary or the build changes.
3. **Commit and push.** GitHub Pages publishes `docs/` from the `main` branch.
4. **Release.** Create a GitHub release named after the version (for example `v6.0.0-draft`), attach
   the four files in `dist/` and the change files in `source/`, and paste the version's section of
   `CHANGELOG.md` as the notes. Once the repository is switched on in Zenodo, each release receives
   a DOI automatically.

The rules on identifiers are strict: an identifier is never reused, and it does not change when a
term moves, also to another facet. `qa/check_skos.R` checks both.

The two tools in this repository have their own build: `brain/` (the taxonomy brain) and `review/`
(the tagging review platform). See the README in each folder.
