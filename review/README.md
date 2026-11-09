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
| `../docs/review/config.js` | Address of the worker |
| `../docs/review/data/` | The taxonomy and the batches of tagged results (static) |
| `scripts/build_data.py` | Writes `../docs/review/data/` from a tagging run |
| `worker/` | The worker and its database schema |

Rules: two reviewers per result; a reviewer sees the other review only once both are submitted;
a review is locked once both are submitted. Reviewers type their first and last name in the bar
at the top on their first visit; the browser remembers it. The same name from another computer
is the same reviewer. A personal link (`?r=<code>`) still works.

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

## Add a reviewer

Nothing to do: reviewers join by typing their name. To create a personal link instead:

```
npx wrangler d1 execute tagging-review --remote --command "INSERT INTO reviewers(code,name) VALUES ('a-long-random-code','First Last')"
```

Their link: `<page address>/?r=a-long-random-code`. Use a long random code: the link is the key.

## Add a batch

```
python scripts/build_data.py --batch <id> --name "<label>" --n 150
```

then commit and push. The page lists every batch in `../docs/review/data/batches.json`.

## The file

"Download file" on the page writes one Excel file: one row per result, the AI verdicts and
tags, then each reviewer's answers (R1, R2), the review status and whether the reviewers agree.

## Local test

`npx wrangler dev --local --port 8788` in `worker/` (with a `worker/.dev.vars` file containing
`ALLOWED_ORIGIN="*"`), `python -m http.server 8000` in `../docs/review/`, `config.js` pointing to
`http://127.0.0.1:8788` (put it back before pushing), then open `http://127.0.0.1:8000/`.
