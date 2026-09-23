# Governance rehearsal: one term request, end to end

Date: 2026-09-23. Purpose: show the request route working before the MELIAF build-shop, with a
proposal that is refused, so that the vocabulary itself does not change and no new version is
needed. Refusals are the more common case in practice and exercise every step of the route.

## The steps, as they happened

1. **Proposal.** A term request was opened with the repository's issue template:
   https://github.com/Mlolita26/cgiar-climate-taxonomy/issues/1
   Proposed: *Climate-resilient agriculture*, a new Intervention under Climate-smart agriculture,
   with a definition, a source, two synonyms and an example of use.
2. **Screening.** The custodian answered the five questions from GOVERNANCE.md in a comment on
   the issue. Result: the concept is already covered in two parts (OTC_114 Climate resilience,
   whose synonyms include "climate-resilient"; INT_269 Climate-smart agriculture for the
   practices), and the proposed label is a compound of the two, not one concept.
3. **Decision.** Refused, with a redirect: use INT_269 for the practices, OTC_114 for the
   outcome, and propose any specific missing practice on its own.
4. **Record.** The issue was labelled `decided: refused` and closed. The decision was logged in
   `governance/decisions.csv` with date, proposal, reason, redirect, and the fact that the
   vocabulary did not change.
5. **Publish.** Nothing to publish: no term changed, so the version stays 5.0.0-draft. The
   decision log is committed to the repository and visible on the Method page.

Time taken: under fifteen minutes.

## What an accepted request would add

Steps 1 to 4 are the same, with the label `decided: accepted`. Then: edit the source (the master
file upstream, then refresh the copy in `source/`), rebuild (`Rscript build_fair.R`), run the
checks (`Rscript qa/check_skos.R`), update `CHANGELOG.md`, tag a new version and create a
release. The identifier of a new term is the next free number in its facet; identifiers are
never reused.

## What differs for the MELIAF taxonomy

The route the build-shop is asked to design has more roles: Communities of Practice and domain
champions screen, the Portfolio Performance Team acts as secretariat, the Performance and
Results Management Steering Group validates by no objection. The mechanics shown here do not
change: a request form, a written screening against agreed questions, a logged decision, a
release only when content changes. Who answers the questions, and who signs off, is the part
the group decides in Rabat.
