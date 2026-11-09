# CGIAR Climate Adaptation and Mitigation Taxonomy

A controlled vocabulary of 768 concepts for describing climate adaptation and mitigation in
agricultural research results: definitions with their sources, synonyms, typed relations, and
for each term its climate area, its tagging role (stand-alone or context-dependent) and the context in which it counts. Developed by the CGIAR
MELIAF Climate Adaptation Activator.

**Version 6.0.0-draft** (taxonomy version 6, revision of 16 October 2026). First published as a draft for the MELIAF build-shop (Rabat, October 2026); version 5 was the first release.

- **Browse:** https://mlolita26.github.io/cgiar-climate-taxonomy/
- **Download:** [Turtle](docs/dist/climate-taxonomy.ttl) · [JSON-LD](docs/dist/climate-taxonomy.jsonld) · [CSV](docs/dist/climate-taxonomy.csv)
- **Each term has its own page**, for example https://mlolita26.github.io/cgiar-climate-taxonomy/terms/CRK_102.html

Two tools that use the taxonomy live in the same repository:

- **Taxonomy brain:** https://mlolita26.github.io/cgiar-climate-taxonomy/brain/ . Type a text and see which words are taxonomy terms or synonyms, and whether the text tells a complete impact pathway.
- **Tagging review:** https://mlolita26.github.io/cgiar-climate-taxonomy/review/ . Two reviewers check the AI tagging of each PRMS result.

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
| `source/` | Copies of the version-6 taxonomy files, the retired identifiers of versions 5 and 6, and `id_corrections.csv`. `SOURCES.md` says where each came from |
| `dist/` | The vocabulary: `climate-taxonomy.ttl`, `.jsonld`, `.csv`, and `meliaf-relations.ttl` |
| `docs/` | The website served by GitHub Pages: landing page and one page per term |
| `templates/` | The two HTML templates the pages are made from (`page.html` shell, `index.html` landing page) |
| `GOVERNANCE.md` | Who decides, how to propose a term, rules that never change |
| `governance/decisions.csv` | Every decision on a term request: date, proposal, decision, reason |
| `notes/` | Working notes, e.g. the governance rehearsal (one request run end to end) |
| `CHANGELOG.md` | What changed in each version (generated; version 6 compared with 5 at the top) |
| `LICENSE.md`, `CITATION.cff` | Licence and how to cite |
| `brain/` | The taxonomy brain: its R build script and page template. The page is published at `docs/brain/` |
| `review/` | The tagging review platform: the script that prepares the data and the Cloudflare worker that stores the reviews. The page is published at `docs/review/` |
| `.gitattributes` | Leaves `brain/` and `review/` out of release archives, so a release (and its DOI) holds only the taxonomy |

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
