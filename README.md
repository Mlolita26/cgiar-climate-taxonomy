# Tagging review

Double review of the AI tagging of PRMS results against the climate taxonomy.
Draft for testing the platform, loaded with the 2025 results (taxonomy v4).

- `index.html`, `app.js`, `style.css`: the page. No build step.
- `config.js`: project URL and publishable key (public by design).
- `sql/001_review_tables.sql`: tables and access rules. Run once in the Supabase SQL editor.
- `scripts/load_batch.py`: loads the taxonomy and a batch of tagged results.

Rules built in: two reviewers per result; a reviewer sees the other review only after both are
submitted; reviews lock once both are submitted. Data stays in Supabase, behind a login.
