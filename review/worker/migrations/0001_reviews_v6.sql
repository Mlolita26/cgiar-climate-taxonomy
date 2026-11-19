-- Migration 0001 (19 Nov 2026): reviews of batches tagged under the CGIAR tagging standard (form "v6" in batches.json).
-- Additive only: it creates one new table and one index. The tables "reviewers" and "reviews" (v4 batches) and
-- their rows are not touched. Safe to run more than once.
-- Apply once, before deploying the worker that uses it:
--   npx wrangler d1 execute tagging-review --remote --file=migrations/0001_reviews_v6.sql
CREATE TABLE IF NOT EXISTS reviews_v6 (
  result_id     TEXT NOT NULL,
  batch_id      TEXT NOT NULL,
  reviewer_code TEXT NOT NULL REFERENCES reviewers(code),
  submitted     INTEGER NOT NULL DEFAULT 0,
  answers       TEXT NOT NULL DEFAULT '{}',   -- JSON: the reviewer's answers and the levels worked out from them (review/README.md)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (result_id, batch_id, reviewer_code)
);
CREATE INDEX IF NOT EXISTS reviews_v6_batch ON reviews_v6(batch_id);
