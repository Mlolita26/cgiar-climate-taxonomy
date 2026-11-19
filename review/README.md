# Tagging review

Double review of the AI tagging of PRMS results against the climate taxonomy.
Same setup as Le Vrai Vote: a static page on GitHub Pages, and a small Cloudflare Worker with a D1
database that stores the reviews. Free, no card, nothing pauses.

**Live page:** https://mlolita26.github.io/cgiar-climate-taxonomy/review/ (one link for everyone)

This folder is part of the climate taxonomy repository. The page itself is published from
`../docs/review/`; this folder holds what builds and serves it.

| Path | What it is |
|---|---|
| `../docs/review/index.html`, `app.js`, `tour.js`, `style.css` | The page and its guided tour. No build step |
| `../docs/review/v6.js` | The review form for batches under the CGIAR tagging standard (form v6) |
| `../docs/review/config.js` | Address of the worker |
| `../docs/review/data/` | One taxonomy file per taxonomy version (`taxonomy-v4.json`, `taxonomy-v6.json`), the batches of tagged results and `batches.json` (static) |
| `scripts/build_data.py` | Writes `../docs/review/data/` from a tagging run |
| `worker/` | The worker, its database schema (`schema.sql`) and the changes to an existing database (`migrations/`) |

Rules: two reviewers per result; a reviewer sees the other review only once both are submitted;
a review is locked once both are submitted. Reviewers type their first and last name in the bar
at the top on their first visit; the browser remembers it. The same name from another computer
is the same reviewer. A personal link (`?r=<code>`) still works.

## Two review forms

Each batch in `batches.json` names its form and its taxonomy file (`form`, `taxonomy_file`). The page
shows the form the batch needs; switching batch in the list at the top loads the right taxonomy.

| Form | Batches | What the reviewer answers | Stored in |
|---|---|---|---|
| v4 | records of the v4 decision rules (August 2026 run), e.g. `test-2025` | agree or disagree with the AI verdict (Full, Partial, Minimal, None) per area; agree or disagree with each tag; terms added; proposals | table `reviews` |
| v6 | records of the CGIAR tagging standard with taxonomy v6 (script `PRMS_Tagging.Rmd`, r11 and later), e.g. `pilot-2025-v6` | per area: the climate measure (agree, not a measure with a reason, or measure missed with the passage) and the purpose (main, additional or not stated, with the test); each tag (agree, change a value, or refuse with a reason); terms found but not kept to keep; terms added and for which area they count; the AI's taxonomy findings (accept, reject, later); pathway parts to correct; proposals | table `reviews_v6` |

In the v6 form the reviewer never chooses a level. The page works out the level of each area (L0 to L3)
and the marker answer (aligned, marker higher, marker lower, cannot determine with its reason, no
comparison) from the answers, with the rules and the comparison table of the tagging script
(`area_level`, `area_rank` and `OUTCOMES` in `Taxonomy/3_Tagging/script/PRMS_Tagging.Rmd`, copied in
`v6.js`; change both together). Climate information for an area means at least one tag that counts for
it (stand-alone or anchored) after the reviewer's changes, or an added term marked as counting for it.
It also works out the outcome of the review: wrong when a level or the marker answer differs from the
AI's; minor gap when only tags, terms, the pathway or the purpose differ; captured well when nothing
differs. The taxonomy findings and the proposals do not count in the outcome. The two reviewers agree
when they end with the same levels and the same marker answer.

Highlighting in the v6 form: only the taxonomy term or synonym found inside each tag's excerpt (the rule
of `term_in()` in `Taxonomy/3_Tagging/script/tools/gen_diag.py`, applied by `build_data.py`, field `hl`),
at the place of the excerpt in the text, so that the same word elsewhere (for example inside a name) is not
marked. When the excerpt is not found word for word in the text, every occurrence of the term is marked; when
no term or synonym of the concept is in the excerpt, the excerpt itself is marked if it has 160 characters or
fewer (85 of 1,410 tags in the pilot batch built on 19 Nov 2026 from script r12; `build_data.py` prints the count).

A v6 review is one JSON object in the column `answers`:

| Key | Content |
|---|---|
| `areas.adaptation`, `areas.mitigation` | `measure` (agree, not_measure, missed), `measure_reason`, `measure_quote`, `purpose` (main, additional, not_stated), `purpose_basis` |
| `tags` | per concept id: `d` (agree, change, refuse) and, when changed, `adaptation`, `mitigation`, `pathway_role`, `status`; `reason` for a refusal; `note` |
| `added_terms`, `added_counts` | concept ids added, and per id `{adaptation: true/false, mitigation: true/false}` |
| `findings` | per AI finding (key: finding type, concept id and phrase, joined by a vertical bar): accept, reject, later |
| `pathway_note`, `proposals`, `comment` | free text; proposals as in the v4 form |
| `computed` | levels, comparison area, marker answer and its reason, outcome of the review, as worked out at the last save |
| `basis` | the batch stamp (`v` in `batches.json`) and the prompt version of the record that was reviewed |

## One-time setup (about 15 minutes)

In a terminal, in `worker/`:

```
npm install
npx wrangler login
npx wrangler d1 create tagging-review
```

Paste the `database_id` it prints into `wrangler.toml`, then:

```
npx wrangler d1 execute tagging-review --remote --file=schema.sql
npx wrangler deploy
```

Put the address it prints (`https://tagging-review.<you>.workers.dev`) in `../docs/review/config.js`, and the
page address in `ALLOWED_ORIGIN` in `wrangler.toml` (then `npx wrangler deploy` again).

`schema.sql` creates every table of a new database. An existing database is changed only by the files in
`worker/migrations/`, each run once, in order.

## Change to the live database for v6 batches (migration 0001)

`worker/migrations/0001_reviews_v6.sql` adds the table `reviews_v6` (one row per result, batch and reviewer,
the answers in one JSON column). It is additive: the tables `reviewers` and `reviews` and the existing reviews of
the v4 batch are not touched, and it can be run twice without harm. Order matters, because a worker that predates
the v6 form would store v6 reviews in the v4 table:

1. the migration, in `worker/`: `npx wrangler d1 execute tagging-review --remote --file=migrations/0001_reviews_v6.sql`
2. the worker: `npx wrangler deploy`
3. the page and the data: commit and push `docs/review/`

If the page reaches a worker that predates the v6 form, it says so above the list and does not save reviews of
v6 batches.

## Add a reviewer

Nothing to do: reviewers join by typing their name. To create a personal link instead:

```
npx wrangler d1 execute tagging-review --remote --command "INSERT INTO reviewers(code,name) VALUES ('a-long-random-code','First Last')"
```

Their link: `<page address>/?r=a-long-random-code`. Use a long random code: the link is the key.

## Add a batch

v4 records (default input: the August 2026 run):

```
python scripts/build_data.py --batch <id> --name "<label>" --n 150
```

v6 records (default input: the 2025 pilot of 200 results; another run with `--tags <folder>/_working/prms_tags.jsonl`):

```
python scripts/build_data.py --form v6 --batch pilot-2025-v6 --name "Pilot 2025, 200 results, taxonomy v6" --n 0
```

`--n 0` keeps every result. The form is read from the records when `--form` is not given. For v6 the script also
reads `prms_drops.jsonl` from the same folder (terms found but not kept) and writes `taxonomy-v6.json` from
`--taxonomy` (default `Taxonomy/1_Versions/v6 - Oct 2026/machine_readable/taxonomy_v6.json`). It can be run again
at any time, for example after a new version of the tagging script: it replaces the batch file and its entry in
`batches.json`, in the same place in the list. Records of script r12 and later carry `marker_outcome_detail` (the
reason shown with "cannot determine"); for older records the page works it out from the same table. Reviews keep
the batch stamp they were made on (`basis` in the answers); rebuild a batch before reviewing starts, or tell the
reviewers that the AI answers changed. Then commit and push. The page lists every batch in `batches.json`; a new
visitor starts on the last one.

## The file

"Download file" on the page writes one Excel file.

- v4 batches: one row per result, the AI verdicts and tags, then each reviewer's answers (R1, R2), the review
  status and whether the reviewers agree.
- v6 batches: sheet `reviews`, one row per result: the AI's levels, comparison area, marker answer and reason,
  terms that count, measures, purposes and flags; the review status and whether the reviewers agree; then for each
  reviewer (R1, R2) the levels and marker answer worked out from their answers, the outcome of the review, the
  measure and purpose answers, tags refused and changed, terms added, findings accepted, rejected or left for
  later, pathway parts to correct, proposals and comment. Sheet `tags`: one row per AI tag and per added term with
  each reviewer's decision. Sheet `findings`: one row per AI taxonomy finding with each reviewer's decision. A
  read-me sheet explains the columns.

## Local test

In `worker/`: `npx wrangler d1 execute tagging-review --local --file=schema.sql` once (a local copy of the
database), then `npx wrangler dev --local --port 8788` (with a `worker/.dev.vars` file containing
`ALLOWED_ORIGIN="*"`). In `../docs/review/`: `python -m http.server 8000`. Point `config.js` to
`http://127.0.0.1:8788` (put it back before pushing), then open `http://127.0.0.1:8000/`. To test migration 0001 as
it will run on the live database, create the local copy from the `schema.sql` of before 19 Nov 2026 (git history)
and run `npx wrangler d1 execute tagging-review --local --file=migrations/0001_reviews_v6.sql`. The local copy
lives in `worker/.wrangler/` (ignored by git; delete it after the test, with `.dev.vars`).
