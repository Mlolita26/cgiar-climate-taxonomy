[![QA](https://github.com/Mlolita26/cgiar-climate-taxonomy/actions/workflows/qa.yml/badge.svg)](https://github.com/Mlolita26/cgiar-climate-taxonomy/actions/workflows/qa.yml)
![Version](https://img.shields.io/badge/version-6.0.0--draft-065F4A)
![Format](https://img.shields.io/badge/format-SKOS-065F4A)
![Licence](https://img.shields.io/badge/licence-CC%20BY%204.0%20(proposed)-B7791F)

# CGIAR Climate Adaptation and Mitigation Taxonomy

A controlled vocabulary of 768 concepts for describing climate adaptation and mitigation in
agricultural research results: definitions with their sources, synonyms, typed relations, and
for each term its climate area, its tagging role (stand-alone or context-dependent), the context
in which it counts, and its review status. Developed by the CGIAR MELIAF Climate Adaptation
Activator. Published in SKOS, the web standard for thesauri and taxonomies.

**Version 6.0.0-draft.** No term is validated yet; see the review status on each term page.

## Browse and search

https://mlolita26.github.io/cgiar-climate-taxonomy/ : a search box on every page, a
[browser](https://mlolita26.github.io/cgiar-climate-taxonomy/browse.html) with the tree of each
facet, and one page per term at a stable address, for example
https://mlolita26.github.io/cgiar-climate-taxonomy/terms/CRK_102.html

## Download

The latest files (always the current release):

| File | Format |
| --- | --- |
| [climate-taxonomy.ttl](https://mlolita26.github.io/cgiar-climate-taxonomy/dist/climate-taxonomy.ttl) | SKOS, Turtle |
| [climate-taxonomy.jsonld](https://mlolita26.github.io/cgiar-climate-taxonomy/dist/climate-taxonomy.jsonld) | SKOS, JSON-LD |
| [climate-taxonomy.csv](https://mlolita26.github.io/cgiar-climate-taxonomy/dist/climate-taxonomy.csv) | CSV |
| [meliaf-relations.ttl](https://mlolita26.github.io/cgiar-climate-taxonomy/dist/meliaf-relations.ttl) | The properties added to SKOS |

Each version is a [GitHub release](https://github.com/Mlolita26/cgiar-climate-taxonomy/releases)
with its files and change list. What changed: [CHANGELOG.md](CHANGELOG.md). The web addresses are
provisional; the planned permanent form is `https://w3id.org/cgiar/climate-taxonomy/<ID>`
(prepared in [w3id/](w3id/), not yet submitted). Term identifiers will not change.

## Cite

Nowak, A. and Muller, L. (2026). CGIAR Climate Adaptation and Mitigation Taxonomy, version
6.0.0-draft. CGIAR MELIAF. A permanent DOI will be issued with the first release after the licence
is confirmed. Machine-readable: [CITATION.cff](CITATION.cff).

## Contribute

Anyone can propose to add, change or retire a term through a
[GitHub issue](https://github.com/Mlolita26/cgiar-climate-taxonomy/issues/new/choose); each kind
of proposal has its own form. How proposals are decided: [GOVERNANCE.md](GOVERNANCE.md). How to
build, check and release: [CONTRIBUTING.md](CONTRIBUTING.md). Everyone follows the
[code of conduct](CODE_OF_CONDUCT.md).

## Licence

Proposed: Creative Commons Attribution 4.0 (CC BY 4.0), pending confirmation by the custodian.
See [LICENSE.md](LICENSE.md).

## Tools in this repository

- **Taxonomy brain:** https://mlolita26.github.io/cgiar-climate-taxonomy/brain/ . Type a text and see which words are taxonomy terms or synonyms, and whether the text tells a complete impact pathway.
- **Tagging review:** https://mlolita26.github.io/cgiar-climate-taxonomy/review/ . Two reviewers check the AI tagging of each PRMS result.
- **How the tagging script works:** https://mlolita26.github.io/cgiar-climate-taxonomy/tagging/ . The script step by step, for readers who do not write code, and where each rule of the tagging standard is applied. Source: [tagging/tagging_script_explained.Rmd](tagging/tagging_script_explained.Rmd).

## Repository layout

| Folder or file | What it holds |
| --- | --- |
| `source/` | Copies of the taxonomy build and its change files (origins in `source/SOURCES.md`) |
| `build_fair.R` | The one script that builds the vocabulary and the web site |
| `templates/` | Page templates used by the build |
| `dist/` | The vocabulary files |
| `docs/` | The web site served by GitHub Pages (`docs/style.css` and `docs/site.js` are written by hand) |
| `qa/` | The checks (`check_skos.R`) and their last report; they also run on GitHub |
| `governance/` | The decision log |
| `w3id/` | The prepared permanent-address request |
| `brain/`, `review/`, `tagging/` | The tools above |

## Contact

Open an [issue](https://github.com/Mlolita26/cgiar-climate-taxonomy/issues). Custodians: Andreea
Nowak and Lolita Muller, Alliance of Bioversity International and CIAT.
