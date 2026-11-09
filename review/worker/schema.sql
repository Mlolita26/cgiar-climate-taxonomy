-- Reviews of the AI tagging. One row per result per reviewer.
CREATE TABLE IF NOT EXISTS reviewers (
  code TEXT PRIMARY KEY,          -- the personal code in the reviewer's link (?r=code)
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  result_id          TEXT NOT NULL,
  batch_id           TEXT NOT NULL,
  reviewer_code      TEXT NOT NULL REFERENCES reviewers(code),
  submitted          INTEGER NOT NULL DEFAULT 0,
  adaptation_ok      INTEGER,      -- 1 agree with the AI verdict, 0 disagree
  adaptation_verdict TEXT,         -- the reviewer's verdict when adaptation_ok = 0
  mitigation_ok      INTEGER,
  mitigation_verdict TEXT,
  tag_decisions      TEXT NOT NULL DEFAULT '{}',  -- JSON {"CONCEPT_ID": "agree" | "disagree"}
  added_terms        TEXT NOT NULL DEFAULT '[]',  -- JSON ["CONCEPT_ID", ...]
  proposals          TEXT NOT NULL DEFAULT '[]',  -- JSON [{"kind": "new"|"synonym", "label", "facet", "of_id", "note"}]
  comment            TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (result_id, reviewer_code)
);
CREATE INDEX IF NOT EXISTS reviews_batch ON reviews(batch_id);
