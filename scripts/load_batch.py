"""Load a taxonomy and a batch of tagged results into the review tables.

    python load_batch.py --batch test-2025 --n 60
    python load_batch.py --batch prms-2025-all --n 0          # 0 = every result in the tags file

Keys are read from the env file of the taxonomy app (SUPABASE_SERVICE_ROLE_KEY bypasses the access
rules, so it is never written anywhere else). Rows are upserted: running it again updates them.
"""
import argparse, json, os, random, sys, urllib.request

ROOT = r"C:\Users\mlolita\OneDrive - CGIAR\Nowak, Andreea (Alliance Bioversity-CIAT)'s files - MELIAF-Implementation"
DEFAULT_TAGS = os.path.join(ROOT, r"Data\outputs\prms_2025_final\_working\prms_tags.jsonl")
DEFAULT_TAX = os.path.join(ROOT, r"Taxonomy\Machine_readable_taxonomy\taxonomy_v4_plus.json")
ENV = r"C:\Users\mlolita\Documents\meliaf-taxonomy-app\.env.local"

ap = argparse.ArgumentParser()
ap.add_argument("--batch", required=True)
ap.add_argument("--name", default="")
ap.add_argument("--n", type=int, default=60)
ap.add_argument("--tags", default=DEFAULT_TAGS)
ap.add_argument("--taxonomy", default=DEFAULT_TAX)
ap.add_argument("--seed", type=int, default=42)
a = ap.parse_args()

env = dict(l.strip().split("=", 1) for l in open(ENV, encoding="utf-8") if "=" in l and not l.startswith("#"))
URL = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/rest/v1/"
KEY = env["SUPABASE_SERVICE_ROLE_KEY"]


def post(table, rows, chunk=200):
    for i in range(0, len(rows), chunk):
        req = urllib.request.Request(URL + table, data=json.dumps(rows[i:i + chunk]).encode("utf-8"), method="POST",
                                     headers={"apikey": KEY, "Authorization": "Bearer " + KEY,
                                              "Content-Type": "application/json",
                                              "Prefer": "resolution=merge-duplicates,return=minimal"})
        try:
            urllib.request.urlopen(req).read()
        except urllib.error.HTTPError as e:
            sys.exit(f"{table}: HTTP {e.code} {e.read().decode()[:400]}")
    print(f"  {table}: {len(rows)} rows")


def role(tag):
    t = (tag or "").lower()
    return "stand-alone" if t.endswith("specific") else "context-dependent" if t.endswith("conditional") else ""


# taxonomy
tax = json.load(open(a.taxonomy, encoding="utf-8"))
tver = os.path.basename(a.taxonomy)
terms = [{"id": c["id"], "term": c["term"], "facet": c.get("facet"), "level": c.get("level"),
          "parent_id": c.get("parent_id"), "synonyms": c.get("synonyms") or [], "definition": c.get("definition"),
          "role_adaptation": role((c.get("adaptation") or {}).get("tag")),
          "role_mitigation": role((c.get("mitigation") or {}).get("tag")),
          "climate_area": c.get("climate_scope"), "taxonomy_version": tver} for c in tax["concepts"]]

# results: a mix of verdicts, so the test batch shows every case
recs = [json.loads(l) for l in open(a.tags, encoding="utf-8") if l.strip()]
if a.n and a.n < len(recs):
    rnd = random.Random(a.seed)
    want = [("Full", 5), ("Partial", 15), ("Minimal", 15), ("None", 15)]
    pick, seen = [], set()
    for v, k in want:
        pool = [r for r in recs if r.get("adaptation_verdict") == v and r["unit_id"] not in seen]
        for r in rnd.sample(pool, min(k, len(pool))):
            pick.append(r); seen.add(r["unit_id"])
    mit = [r for r in recs if r.get("mitigation_verdict") in ("Full", "Partial") and r["unit_id"] not in seen]
    for r in rnd.sample(mit, min(max(0, a.n - len(pick)), len(mit))):
        pick.append(r); seen.add(r["unit_id"])
    recs = pick[:a.n]

KEEP = ("concept_id", "concept_name", "facet", "a_tag", "m_tag", "a_counts", "m_counts", "pathway_stage",
        "adaptation_relation", "adaptation_anchor_id", "mitigation_relation", "mitigation_anchor_id", "detection_excerpt")
results = [{"id": str(r["unit_id"]), "batch_id": a.batch, "title": r.get("title"), "description": r.get("description"),
            "climate_marker": r.get("climate_marker"), "level": r.get("level"), "type": r.get("type"),
            "ai_adaptation": r.get("adaptation_verdict"), "ai_mitigation": r.get("mitigation_verdict"),
            "ai_scope": r.get("climate_scope"),
            "ai_adaptation_elements": r.get("adaptation_elements") or [], "ai_mitigation_elements": r.get("mitigation_elements") or [],
            "ai_adaptation_pathway": r.get("adaptation_pathway") or "", "ai_mitigation_pathway": r.get("mitigation_pathway") or "",
            "ai_tags": [{k: t.get(k) for k in KEEP} for t in r.get("tags") or []]} for r in recs]

print(f"loading batch '{a.batch}': {len(results)} results, taxonomy {tver} ({len(terms)} terms)")
post("rv_terms", terms)
post("rv_batches", [{"id": a.batch, "name": a.name or a.batch, "taxonomy_version": tver}])
post("rv_results", results)
