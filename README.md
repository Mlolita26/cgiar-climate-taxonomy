# CGIAR Climate Adaptation and Mitigation Taxonomy

A controlled vocabulary of 739 concepts for describing climate adaptation and mitigation in
agricultural research results: definitions with their sources, synonyms, typed relations, and
the conditions under which a term counts as adaptation or mitigation. Developed by the CGIAR
MELIAF Climate Adaptation Activator.

**Version 5.0.0-draft.** Published as a draft for the MELIAF build-shop (Rabat, October 2026).

- **Browse:** https://mlolita26.github.io/cgiar-climate-taxonomy/
- **Download:** [Turtle](docs/dist/climate-taxonomy.ttl) · [JSON-LD](docs/dist/climate-taxonomy.jsonld) · [CSV](docs/dist/climate-taxonomy.csv)
- **Each term has its own page**, for example https://mlolita26.github.io/cgiar-climate-taxonomy/terms/CRK_102.html

## What "FAIR" means here, in plain words

- **Findable:** every term has a stable identifier (`CRK_102`) and its own web address.
- **Accessible:** the whole vocabulary can be downloaded in standard formats; each term page
  also carries a machine-readable copy of the term (JSON-LD).
- **Interoperable:** the vocabulary is encoded in SKOS, the web standard for vocabularies, with a
  small documented extension for the typed relations the decision rules use.
- **Reusable:** a licence (CC BY 4.0, proposed), the source of every definition, the provenance
  of every concept, a change log, and rules for how the vocabulary changes.

What is still pending for the draft: a permanent web namespace, confirmation of the licence,
a DOI, and registration in a vocabulary repository. See the self-assessment on the landing page.

## Files

| File or folder | What it is |
| --- | --- |
| `build_fair.R` | The one script. Reads `source/`, writes `dist/` and `docs/`. Run: `Rscript build_fair.R` |
| `qa/check_skos.R` | Checks the result (structure always; parsing too if `rdflib` is installed). Run: `Rscript qa/check_skos.R` |
| `source/` | Copies of the version-5 taxonomy files. `SOURCES.md` says where each came from |
| `dist/` | The vocabulary: `climate-taxonomy.ttl`, `.jsonld`, `.csv`, and `meliaf-relations.ttl` |
| `docs/` | The website served by GitHub Pages: landing page and one page per term |
| `templates/` | The two HTML templates the pages are made from (`page.html` shell, `index.html` landing page) |
| `GOVERNANCE.md` | Who decides, how to propose a term, rules that never change |
| `governance/decisions.csv` | Every decision on a term request: date, proposal, decision, reason |
| `notes/` | Working notes, e.g. the governance rehearsal (one request run end to end) |
| `CHANGELOG.md` | What changed between version 4 and 5 (generated) |
| `LICENSE.md`, `CITATION.cff` | Licence and how to cite |

## Propose a term

Anyone in CGIAR can propose to add, change, merge or retire a term:
[open a term request](https://github.com/Mlolita26/cgiar-climate-taxonomy/issues/new?template=term-request.yml).

## Rebuild

Needs R with `dplyr`, `purrr`, `tidyr`, `stringr`, `readr`, `jsonlite`, `glue`.

```
Rscript build_fair.R
Rscript qa/check_skos.R
```

To change the web namespace, licence or version, edit the settings block at the top of
`build_fair.R` and rebuild. Nothing else needs to change.
