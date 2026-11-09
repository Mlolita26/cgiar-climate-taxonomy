# Source files

Every file in this folder is a **copy**. The originals stay where they are and are never moved
or edited from here. To refresh a copy, copy the original again and update this table.

Origin folders (copied 2026-11-09 for version 6):
- `MELIAF-Implementation/Taxonomy/1_Versions/v6 - Oct 2026/` (taxonomy v6, built 2026-11-09 by
  `machine_readable/build_taxonomy_v6.R` from `master_v6.csv`, the revision of 16 October 2026).
  Compared with the PUBLISHED v5 (`v5 - Sep 2026/machine_readable/taxonomy_v5.json`, 739 concepts),
  not with `master_v5_clean.csv`, which is an earlier 736-concept state. The build reports 3 errors
  in the master: OUT_082 has no impact area (not published); INT_267 points to OUT_081, which moved
  to INT_334 in v6 (that relation is left out); CCC_39 reuses a retired identifier. It also lists 17
  IDs whose label changed: 15 are renames, and 2 (CCC_38, SYS_118) are IDs reused for a different
  concept. The three reused IDs are published under new numbers (`id_corrections.csv`).
- `MELIAF-Implementation/Taxonomy/1_Versions/v5 - Sep 2026/` for the files that did not change in v6.

| File | Original | sha1 (first 12) | Copied on | What it is |
| --- | --- | --- | --- | --- |
| `taxonomy_v6.json` | `v6 - Oct 2026/machine_readable/` | `b5d99a132411` | 2026-11-09 | The taxonomy: 768 concepts with synonyms, definitions, relations, climate area, tagging role, context rule |
| `v6_retired_ids.csv` | `v6 - Oct 2026/changes/` | `d593add8d592` | 2026-11-09 | The 10 published v5 IDs not in v6 (eight moved to a new ID, two dropped), each with its successor |
| `v5_to_v6_TERM_CHANGES.csv` | `v6 - Oct 2026/changes/` | `1a833677fd0c` | 2026-11-09 | Term-level changes from v5 to v6 (feeds CHANGELOG.md) |
| `v5_to_v6_SYNONYM_CHANGES.csv` | `v6 - Oct 2026/changes/` | `96e060fb4bb4` | 2026-11-09 | Synonym-level changes from v5 to v6 (feeds CHANGELOG.md) |
| `v5_retired_ids.csv` | `v5 - Sep 2026/changes/` | `c906ec72bda4` | 2026-09-23 | IDs retired in v5, each with its successor and reason |
| `master_v5_controlled_values.csv` | `v5 - Sep 2026/` | `273c54bd8ef8` | 2026-09-23 | Allowed values and definitions for facets, levels, stages, domains (unchanged in v6) |
| `Master_v5_metadata.csv` | `v5 - Sep 2026/` | `b574afafab64` | 2026-09-23 | Column-by-column description of the v5 master (v6 has no metadata file yet) |
| `DO_NOT_ADD_register.csv` | `2_Rules_and_standards/` | `5759c466242e` | 2026-09-23 | Terms proposed and refused, with reasons (governance evidence) |

The version 5 copies (`taxonomy_v5.json`, `v4_to_v5_*_CHANGES.csv`) were removed on 2026-11-09;
they remain in the repository history and in the v5 version folder.

Written here, not copied:

| File | What it is |
| --- | --- |
| `provenance_map.csv` | Maps the free-text provenance strings in the taxonomy to four controlled classes |
| `relation_definitions.csv` | One-line definition of each typed relation, published in `dist/meliaf-relations.ttl` |
| `id_corrections.csv` | Identifiers published differently from the master, with the reason: CCC_39, CCC_38 and SYS_118 are reused in master_v6 for new concepts and published as CCC_49, CCC_50 and SYS_123; the build retires CCC_38 and SYS_118 with their v5 meaning |
| `fair_checklist.csv` | The FAIR self-assessment shown on the landing page (tests from Cox et al. 2021, Table 1) |
