"""Write the static data the review page reads: the taxonomy and one batch of tagged results.

    python scripts/build_data.py --batch test-2025 --n 60
    python scripts/build_data.py --batch prms-2025-all --n 0      # 0 = every result in the tags file

Writes data/taxonomy.json, data/batch-<batch>.json and updates data/batches.json.
Reviews are not here: they are stored by the worker (worker/).
"""
import argparse, hashlib, json, os, random

ROOT = r"C:\Users\mlolita\OneDrive - CGIAR\Nowak, Andreea (Alliance Bioversity-CIAT)'s files - MELIAF-Implementation"
DEFAULT_TAGS = os.path.join(ROOT, r"Data\outputs\prms_2025_final\_working\prms_tags.jsonl")
DEFAULT_TAX = os.path.join(ROOT, r"Taxonomy\Machine_readable_taxonomy\taxonomy_v4_plus.json")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

ap = argparse.ArgumentParser()
ap.add_argument("--batch", required=True)
ap.add_argument("--name", default="")
ap.add_argument("--n", type=int, default=60)
ap.add_argument("--tags", default=DEFAULT_TAGS)
ap.add_argument("--taxonomy", default=DEFAULT_TAX)
ap.add_argument("--seed", type=int, default=42)
a = ap.parse_args()
os.makedirs(OUT, exist_ok=True)


def role(tag):
    t = (tag or "").lower()
    return "stand-alone" if t.endswith("specific") else "context-dependent" if t.endswith("conditional") else ""


tax = json.load(open(a.taxonomy, encoding="utf-8"))
tver = os.path.basename(a.taxonomy)
terms = [{"id": c["id"], "term": c["term"], "facet": c.get("facet"), "level": c.get("level"),
          "parent_id": c.get("parent_id"), "synonyms": c.get("synonyms") or [], "definition": c.get("definition") or "",
          "role_a": role((c.get("adaptation") or {}).get("tag")), "role_m": role((c.get("mitigation") or {}).get("tag"))}
         for c in tax["concepts"]]
json.dump({"version": tver, "terms": terms}, open(os.path.join(OUT, "taxonomy.json"), "w", encoding="utf-8"), ensure_ascii=False)

recs = [json.loads(l) for l in open(a.tags, encoding="utf-8") if l.strip()]
if a.n and a.n < len(recs):                      # a mix of verdicts, so the batch shows every case
    rnd, pick, seen = random.Random(a.seed), [], set()
    for v, k in [("Full", 5), ("Partial", 15), ("Minimal", 15), ("None", 15)]:
        pool = [r for r in recs if r.get("adaptation_verdict") == v and r["unit_id"] not in seen]
        for r in rnd.sample(pool, min(k, len(pool))):
            pick.append(r); seen.add(r["unit_id"])
    mit = [r for r in recs if r.get("mitigation_verdict") in ("Full", "Partial") and r["unit_id"] not in seen]
    pick += rnd.sample(mit, min(max(0, a.n - len(pick)), len(mit)))
    recs = pick[:a.n]

aslist = lambda x: x if isinstance(x, list) else ([x] if x else [])   # a single element is stored as plain text
KEEP = ("concept_id", "concept_name", "facet", "a_counts", "m_counts", "pathway_stage", "detection_excerpt")
results = [{"id": str(r["unit_id"]), "title": r.get("title") or "", "description": r.get("description") or "",
            "marker": r.get("climate_marker") or "", "level": r.get("level") or "", "type": r.get("type") or "",
            "ai_a": r.get("adaptation_verdict"), "ai_m": r.get("mitigation_verdict"),
            "ai_a_el": aslist(r.get("adaptation_elements")), "ai_m_el": aslist(r.get("mitigation_elements")),
            "ai_a_path": r.get("adaptation_pathway") or "", "ai_m_path": r.get("mitigation_pathway") or "",
            "tags": [{k: t.get(k) for k in KEEP} for t in r.get("tags") or []]} for r in recs]
results.sort(key=lambda r: (not r["id"].isdigit(), int(r["id"]) if r["id"].isdigit() else 0, r["id"]))
json.dump({"batch": a.batch, "taxonomy": tver, "results": results},
          open(os.path.join(OUT, f"batch-{a.batch}.json"), "w", encoding="utf-8"), ensure_ascii=False)

bp = os.path.join(OUT, "batches.json")
batches = [b for b in (json.load(open(bp, encoding="utf-8")) if os.path.exists(bp) else []) if b["id"] != a.batch]
# v / tv: short content stamps, so browsers cache the files and fetch them again only when they change
stamp = lambda f: hashlib.sha1(open(os.path.join(OUT, f), "rb").read()).hexdigest()[:10]
batches.append({"id": a.batch, "name": a.name or a.batch, "taxonomy": tver, "n": len(results),
                "v": stamp(f"batch-{a.batch}.json"), "tv": stamp("taxonomy.json")})
json.dump(batches, open(bp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"batch '{a.batch}': {len(results)} results · taxonomy {tver}: {len(terms)} terms -> data/")
