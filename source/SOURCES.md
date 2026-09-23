# Source files

Every file in this folder is a **copy**. The originals stay where they are and are never moved
or edited from here. To refresh a copy, copy the original again and update this table.

Origin folder: `MELIAF-Implementation/Taxonomy/V5_Cleanup/` (taxonomy v5, built 2026-09-04 by
`build_taxonomy_v5.R` from `master_v5.csv`, source sha1 `1fbf14c48859`, 0 build errors).

| File | Original modified | sha1 (first 12) | Copied on | What it is |
| --- | --- | --- | --- | --- |
| `taxonomy_v5.json` | 2026-09-04 | `c61ce9ffdf72` | 2026-09-23 | The taxonomy: 739 concepts with synonyms, definitions, relations, rule tags |
| `v5_retired_ids.csv` | 2026-09-04 | `c906ec72bda4` | 2026-09-23 | IDs retired in v5, each with its successor and reason |
| `v4_to_v5_TERM_CHANGES.csv` | 2026-09-04 | `d9cfbe6dc9e9` | 2026-09-23 | Term-level changes from v4 to v5 (feeds CHANGELOG.md) |
| `v4_to_v5_SYNONYM_CHANGES.csv` | 2026-09-04 | `65342cf44b51` | 2026-09-23 | Synonym-level changes from v4 to v5 (feeds CHANGELOG.md) |
| `Master_v5_metadata.csv` | 2026-09-04 | `b574afafab64` | 2026-09-23 | Column-by-column description of the master file |
| `master_v5_controlled_values.csv` | 2026-09-03 | `273c54bd8ef8` | 2026-09-23 | Allowed values for facets, levels, tags, and their definitions |
| `DO_NOT_ADD_register.csv` | 2026-09-04 | `5759c466242e` | 2026-09-23 | Terms proposed and refused, with reasons (governance evidence) |

Written here, not copied:

| File | What it is |
| --- | --- |
| `provenance_map.csv` | Maps the free-text provenance strings in the taxonomy to four controlled classes |
| `relation_definitions.csv` | One-line definition of each typed relation, published in `dist/meliaf-relations.ttl` |
| `fair_checklist.csv` | The FAIR self-assessment shown on the landing page (tests from Cox et al. 2021, Table 1) |
