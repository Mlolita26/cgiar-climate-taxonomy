# Governance

## Custodian

The CGIAR MELIAF Climate Adaptation Activator team is the content custodian of this vocabulary:
Andreea Nowak (lead) and Lolita Muller (Alliance of Bioversity International and CIAT). The
custodian decides what enters, changes or leaves the vocabulary, and publishes releases.

This is the arrangement for the draft. The MELIAF build-shop in Rabat (October 2026) decides the
governance of the wider MELIAF taxonomy; this vocabulary will follow that route once it exists.

## Anyone can propose

Anyone in CGIAR, and later partners, can propose to **add**, **change**, **merge** or **retire**
a term. Open an issue with the *Term request* template. It asks for the same things the
custodian needs to decide: the proposed term, a definition, its source, the facet and parent it
belongs under, synonyms, and evidence that the term is actually used in CGIAR work.

## How a proposal is screened

The custodian applies the term intake protocol used to build version 5. In short:

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
  in the hierarchy keeps its identifier, as long as the concept is the same.

## Releases

Changes are collected and published as numbered versions (semantic versioning: a new major
version when identifiers are retired or meanings change, minor for additions, patch for
corrections). Each release has a change log and, once out of draft, a citable DOI.
The files people and systems read are always the latest release; earlier releases stay
available.

## Status of this version

`5.0.0-draft`. Published for the MELIAF build-shop so the container can be seen working. The
licence (CC BY 4.0) is proposed and awaits the custodian's confirmation. The identifiers use the
GitHub Pages address for now; a permanent namespace will replace it after the build-shop,
without changing the term IDs.
