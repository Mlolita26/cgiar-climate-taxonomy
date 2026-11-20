# Governance

## Custodian

The CGIAR MELIAF Climate Adaptation Activator team is the content custodian of this vocabulary:
Andreea Nowak (lead) and Lolita Muller (Alliance of Bioversity International and CIAT). The
custodian decides what enters, changes or leaves the vocabulary, and publishes releases.

This is the arrangement for the draft. The MELIAF build-shop in Rabat (October 2026) decides the
governance of the wider MELIAF taxonomy; this vocabulary will follow that route once it exists.

## Anyone can propose

Anyone in CGIAR, and later partners, can propose to **add**, **change**, **merge** or **retire**
a term. Open an issue with one of the forms (New term, Synonym, Change a term, Retire a term,
Report an error); see [CONTRIBUTING.md](CONTRIBUTING.md). The forms ask for what the custodian
needs to decide: the term, a definition, its source, the facet and broader term, synonyms,
evidence that the term is used in CGIAR work, and optionally the proposer's ORCID for credit.

## How a proposal is screened

The custodian applies the term intake protocol used to build versions 5 and 6. In short:

1. **Is it already here?** Search labels and synonyms. If the concept exists under another
   word, the proposal becomes a synonym, not a new term.
2. **Is it one concept?** One term, one meaning. Compound phrases that only add an adjective to
   an existing term are refused (the label already matches).
3. **Does it have a defensible definition?** Genus-differentia form, with a named source,
   following the hierarchy IPCC, then AGROVOC, then FAO/WMO/UNFCCC.
4. **Is it used?** Evidence from CGIAR reporting or plans that the word occurs and matters.
5. **Where does it sit?** One facet, one parent; the parent must be a true "is-a" parent.

Every decision is logged in `governance/decisions.csv`: date, proposal, decision, reason, redirect,
and whether the vocabulary changed. Refused proposals stay visible so the same discussion does not
happen twice. A worked example: [issue #1](https://github.com/Mlolita26/cgiar-climate-taxonomy/issues/1),
*Climate-resilient agriculture*, refused on 2026-09-23 because it is a compound of two existing
concepts (see `notes/governance-rehearsal.md` for the steps).

## Rules that never change

- **Identifiers are permanent.** An ID, once assigned, is never reused for another concept.
- **Retire, do not delete.** A retired term stays in the vocabulary, marked deprecated and
  pointing to its successor, so that past reporting stays interpretable.
- **Definitions can improve, identifiers do not move.** Editing a definition or moving a term
  in the hierarchy keeps its identifier, as long as the concept is the same. This holds also when
  the term moves to another facet: the identifier keeps its old prefix (for example an `INT_`
  term that becomes an output stays `INT_...`). The prefix tells where a term was first placed,
  not where it is now; the facet is recorded separately. (Rule made explicit on 2026-11-20. In
  version 6, eight terms that changed facet received new identifiers before this rule; they stay
  as published, with the old identifier retired and pointing to the new one. `qa/check_skos.R`
  fails if a later release does this again.)
- **New identifiers are never recycled.** A new concept takes the next unused number of its
  facet prefix, never the number of a retired concept.

## Review status of each term

Each term carries a review status (`meliaf:reviewStatus`), taken from the column Final verdict of
the version 6 master and the rules written with it (Climate Master v6):

- **awaiting external validation**: every stand-alone term, and the context-dependent terms whose
  meaning the climate community sets (definitions from the IPCC, UNFCCC, WMO or GCOS, for example
  Rainfall) or that name a broad category of systems (System terms at L1 or L2, for example Crop
  system). These go to validation by the climate community.
- **awaiting internal review**: the other terms, reviewed internally by mapping them to CGIAR
  domains.
- **review route to be decided**: not yet assigned.

No term is validated yet. When a review is complete, the status of its terms changes in the next
release.

## Releases

Changes are collected and published as numbered versions (semantic versioning: a new major
version when identifiers are retired or meanings change, minor for additions, patch for
corrections). Each release has a change log and, once out of draft, a citable DOI.
The files people and systems read are always the latest release; earlier releases stay
available.

## Status of this version

`6.0.0-draft` (taxonomy version 6). Version 5 was published for the MELIAF build-shop so the container could be seen working; version 6 replaces it. The
licence (CC BY 4.0) is proposed and awaits the custodian's confirmation. The identifiers use the
GitHub Pages address for now; a permanent namespace will replace it after the build-shop,
without changing the term IDs.
