"""Write the static data the review page reads: the taxonomy and one batch of tagged results.

    python scripts/build_data.py --batch test-2025 --n 60                      # v4 records (August 2026 run)
    python scripts/build_data.py --batch prms-2025-all --n 0                   # 0 = every result in the tags file
    python scripts/build_data.py --form v6 --batch pilot-2025-v6 --name "Pilot 2025, 200 results, taxonomy v6" --n 0

Writes docs/review/data/taxonomy-v<N>.json (one file per taxonomy version), docs/review/data/batch-<batch>.json and
updates docs/review/data/batches.json. Each batch names its taxonomy file and its form there:
  form v4  records of the v4 decision rules (verdicts Full / Partial / Minimal / None), the first review form
  form v6  records of the CGIAR tagging standard (levels L0 to L3, marker answer), the review form by area
The form is read from the records when --form is not given. The script can be run again at any time: it replaces the
batch file and the batch's entry in batches.json. Reviews are not here: they are stored by the worker (worker/).
"""
import argparse, hashlib, json, os, random, re, sys

# The project folder that holds Taxonomy/: four levels above this script (Taxonomy/4_Climate_taxonomy_repository/review/
# scripts/), or the folder given in the environment variable MELIAF_ROOT.
ROOT = os.environ.get("MELIAF_ROOT") or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
DEFAULT_TAGS = os.path.join(ROOT, r"Taxonomy\3_Tagging\outputs\2026-08 2025 marked - 4343 results - v4\_working\prms_tags.jsonl")
DEFAULT_TAX = os.path.join(ROOT, r"Taxonomy\1_Versions\v4 - Aug 2026\machine_readable\taxonomy_v4_plus.json")
DEFAULT_V6_TAGS = os.path.join(ROOT, r"Taxonomy\3_Tagging\outputs\2026-11 2025 pilot - 200 results - v6\_working\prms_tags.jsonl")
DEFAULT_V6_TAX = os.path.join(ROOT, r"Taxonomy\1_Versions\v6 - Oct 2026\machine_readable\taxonomy_v6.json")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "review", "data")

ap = argparse.ArgumentParser()
ap.add_argument("--batch", required=True)
ap.add_argument("--name", default="")
ap.add_argument("--n", type=int, default=60)
ap.add_argument("--form", choices=["auto", "v4", "v6"], default="auto", help="auto = read it from the records")
ap.add_argument("--tags", default=None, help="prms_tags.jsonl of the run")
ap.add_argument("--drops", default=None, help="v6 only: prms_drops.jsonl (default: next to the tags file)")
ap.add_argument("--taxonomy", default=None)
ap.add_argument("--seed", type=int, default=42)
ap.add_argument("--out", default=OUT, help="output folder (default docs/review/data); another folder for a test")
a = ap.parse_args()
a.tags = a.tags or (DEFAULT_V6_TAGS if a.form == "v6" else DEFAULT_TAGS)
OUT = a.out
os.makedirs(OUT, exist_ok=True)

recs = [json.loads(l) for l in open(a.tags, encoding="utf-8") if l.strip()]
form = a.form if a.form != "auto" else ("v6" if any("marker_outcome" in r or "comparison_level" in r for r in recs) else "v4")
a.taxonomy = a.taxonomy or (DEFAULT_V6_TAX if form == "v6" else DEFAULT_TAX)   # default taxonomy follows the form

tax = json.load(open(a.taxonomy, encoding="utf-8"))
tver = os.path.basename(a.taxonomy)
m = re.search(r"taxonomy_v(\d+)", tver) or re.search(r"/v(\d+)\b", str((tax.get("meta") or {}).get("schema") or ""))
tfile = "taxonomy-v%s.json" % m.group(1) if m else "taxonomy-%s.json" % os.path.splitext(tver)[0]


def role(tag):
    t = (tag or "").lower()
    return "stand-alone" if t.endswith("specific") else "context-dependent" if t.endswith("conditional") else ""


# The tagging role per area, read as the tagging script reads it (load_taxonomy_json in PRMS_Tagging.Rmd): from the
# climate area and the tagging role, and for a few terms from the start of the context rule. "" = not classified for
# the area. The script's provisional overrides are not applied here; each tag carries the role the script used.
MIX_M = re.compile(r"^\s*Stand-alone for mitigation\.\s*Adaptation \(context-dependent\)")
MIX_A = re.compile(r"^\s*Stand-alone for adaptation\.\s*Mitigation \(context-dependent\)")


def roles_v6(c):
    area, rule = c.get("climate_area") or "", c.get("context_rule") or ""
    sa = c.get("tagging_role") == "Stand-alone"
    in_a, in_m = "Adaptation" in area, "Mitigation" in area
    ra = "" if not in_a else "stand-alone" if sa else "context-dependent"
    rm = "" if not in_m else "stand-alone" if sa else "context-dependent"
    if MIX_M.match(rule):
        ra, rm = ("context-dependent" if in_a else ""), ("stand-alone" if in_m else "")
    if MIX_A.match(rule):
        ra, rm = ("stand-alone" if in_a else ""), ("context-dependent" if in_m else "")
    return ra, rm


concepts, seen_ids, dup = [], set(), []
for c in tax["concepts"]:
    if c["id"] in seen_ids:                 # an id used twice in the master: the script reads the first one
        dup.append("%s (%s)" % (c["id"], c.get("term")))
        continue
    seen_ids.add(c["id"])
    concepts.append(c)
if dup:
    print("warning: ids used twice in the taxonomy, later ones left out: " + ", ".join(dup), file=sys.stderr)

if form == "v4":
    terms = [{"id": c["id"], "term": c["term"], "facet": c.get("facet"), "level": c.get("level"),
              "parent_id": c.get("parent_id"), "synonyms": c.get("synonyms") or [], "definition": c.get("definition") or "",
              "role_a": role((c.get("adaptation") or {}).get("tag")), "role_m": role((c.get("mitigation") or {}).get("tag"))}
             for c in concepts]
else:
    terms = []
    for c in concepts:
        ra, rm = roles_v6(c)
        terms.append({"id": c["id"], "term": c["term"], "facet": c.get("facet"), "level": c.get("level"),
                      "parent_id": c.get("parent_id"), "synonyms": c.get("synonyms") or [], "definition": c.get("definition") or "",
                      "role_a": ra, "role_m": rm, "climate_area": c.get("climate_area") or "",
                      "tagging_role": c.get("tagging_role") or "", "context_rule": c.get("context_rule") or ""})
json.dump({"version": tver, "terms": terms}, open(os.path.join(OUT, tfile), "w", encoding="utf-8"), ensure_ascii=False)

aslist = lambda x: x if isinstance(x, list) else ([x] if x else [])   # a single element is stored as plain text

if form == "v4":
    if a.n and a.n < len(recs):                      # a mix of verdicts, so the batch shows every case
        rnd, pick, seen = random.Random(a.seed), [], set()
        for v, k in [("Full", 5), ("Partial", 15), ("Minimal", 15), ("None", 15)]:
            pool = [r for r in recs if r.get("adaptation_verdict") == v and r["unit_id"] not in seen]
            for r in rnd.sample(pool, min(k, len(pool))):
                pick.append(r); seen.add(r["unit_id"])
        mit = [r for r in recs if r.get("mitigation_verdict") in ("Full", "Partial") and r["unit_id"] not in seen]
        pick += rnd.sample(mit, min(max(0, a.n - len(pick)), len(mit)))
        recs = pick[:a.n]

    KEEP = ("concept_id", "concept_name", "facet", "a_counts", "m_counts", "pathway_stage", "detection_excerpt")
    results = [{"id": str(r["unit_id"]), "title": r.get("title") or "", "description": r.get("description") or "",
                "marker": r.get("climate_marker") or "", "level": r.get("level") or "", "type": r.get("type") or "",
                "ai_a": r.get("adaptation_verdict"), "ai_m": r.get("mitigation_verdict"),
                "ai_a_el": aslist(r.get("adaptation_elements")), "ai_m_el": aslist(r.get("mitigation_elements")),
                "ai_a_path": r.get("adaptation_pathway") or "", "ai_m_path": r.get("mitigation_pathway") or "",
                "tags": [{k: t.get(k) for k in KEEP} for t in r.get("tags") or []]} for r in recs]
    prompts = ""
else:
    # ------------------------------------------------------------------ v6 records (CGIAR tagging standard)
    by = {}
    for r in recs:                                   # the last row per result wins, as in the tagging script
        by[str(r.get("unit_id"))] = r
    recs = list(by.values())
    if a.n and a.n < len(recs):                      # spread over the marker answers and the levels
        rnd, groups = random.Random(a.seed), {}
        for r in recs:
            groups.setdefault((r.get("marker_outcome"), r.get("comparison_level")), []).append(r)
        pick, keys = [], sorted(groups, key=str)
        while len(pick) < a.n and any(groups.values()):
            for k in keys:
                if groups[k] and len(pick) < a.n:
                    pick.append(groups[k].pop(rnd.randrange(len(groups[k]))))
        recs = pick

    # Highlighting: the taxonomy term or synonym as written inside each tag's excerpt (the excerpt can be a whole
    # passage). Same rule as term_in() in Taxonomy/3_Tagging/script/tools/gen_diag.py; the full excerpt is used only
    # when no term or synonym of the concept is found in it.
    FORMS = {}
    for c in concepts:
        FORMS[str(c["id"])] = [f for f in [c.get("term")] + list(c.get("synonyms") or []) if f]
    _SEP = r"[\s\-‐‑–—/]+"

    def _tok_rx(t):
        t = re.escape(t)
        if t.endswith("y"):
            return t[:-1] + "(?:y|ies)"
        if t.endswith(("s", "x", "z")):
            return t + "(?:es)?"
        return t + "(?:s|es)?"

    def term_in(excerpt, cid):
        """the longest taxonomy term or synonym of the concept as written inside the excerpt, or None"""
        best = None
        for f in FORMS.get(str(cid), []):
            toks = [x for x in re.split(r"[\W_]+", str(f).lower()) if x]
            if not toks:
                continue
            mm = re.search(r"(?<!\w)" + _SEP.join(_tok_rx(x) for x in toks) + r"(?!\w)", excerpt or "", re.IGNORECASE)
            if mm and (best is None or len(mm.group(0)) > len(best)):
                best = mm.group(0)
        return best

    def where_in(text, cid, words=""):
        """where the concept is in the text: the AI's own words when it gave them, else the longest term or synonym
        (an acronym such as GAP only in capitals, so it does not match 'gaps'), with about 60 characters on each side"""
        text = text or ""
        hit = None
        if words:
            mm = re.search(r"(?<!\w)" + re.escape(words) + r"(?!\w)", text, re.IGNORECASE)
            if mm:
                hit = (mm.start(), mm.end())
        if hit is None:
            for f in FORMS.get(str(cid), []):
                f = str(f)
                acronym = f.isupper() and len(f) <= 6
                toks = [x for x in re.split(r"[\W_]+", f if acronym else f.lower()) if x]
                if not toks:
                    continue
                rx = r"(?<!\w)" + (_SEP.join(re.escape(x) for x in toks) if acronym else _SEP.join(_tok_rx(x) for x in toks)) + r"(?!\w)"
                mm = re.search(rx, text, 0 if acronym else re.IGNORECASE)
                if mm and (hit is None or mm.end() - mm.start() > hit[1] - hit[0]):
                    hit = (mm.start(), mm.end())
        if hit is None:
            return "", ""
        a0, b0 = max(0, hit[0] - 60), min(len(text), hit[1] + 60)
        return text[hit[0]:hit[1]], ("…" if a0 > 0 else "") + text[a0:b0] + ("…" if b0 < len(text) else "")

    # Terms found but not kept: prms_drops.jsonl, one line per result. Only refusals of a whole term whose concept is
    # not among the kept tags; refused anchors, links and statuses of kept tags are shown on the tags themselves.
    NOT_TERM = {"link_not_valid", "finding_excerpt_not_in_text"}
    dpath = a.drops or os.path.join(os.path.dirname(a.tags), "prms_drops.jsonl")
    drops = {}
    if os.path.exists(dpath):
        for l in open(dpath, encoding="utf-8"):
            if l.strip():
                d = json.loads(l)
                drops.setdefault(str(d.get("unit_id")), []).extend(d.get("drops") or [])
    else:
        print("note: no drops file at %s; 'terms found but not kept' will be empty" % dpath, file=sys.stderr)
    tname = {str(c["id"]): c.get("term") for c in concepts}

    # Closest existing term in the whole taxonomy (20 Nov 2026): for a phrase proposed as a new term, and for the words of
    # a term left out as "another meaning", the term or synonym that shares most of its words (simple word stems; a word
    # that ends with a term word counts, so "groundwater" matches "water"). Kept when the score is 0.6 or more and the match
    # is not only on a general word. A suggestion for the reviewer, never a tag.
    STOP = {"of", "the", "and", "for", "in", "on", "to", "a", "an", "with", "by", "or", "at", "from"}
    GENERAL = {"management", "system", "practice", "climate", "approach", "service", "method", "development", "use",
               "smart", "resilient", "resilience", "low", "sustainable", "integrated", "improved", "new"}
    def stem(wd):
        for suf in ("ations", "ation", "ments", "ment", "ings", "ing", "ies", "ed", "es", "s"):
            if wd.endswith(suf) and len(wd) - len(suf) >= 4:
                return wd[: -len(suf)] + ("y" if suf == "ies" else "")
        return wd
    def toks(s):
        return [w for w in re.split(r"[^a-z0-9]+", str(s).lower()) if w and w not in STOP]
    def same(a, b):
        sa, sb = stem(a), stem(b)
        # a compound counts only when the rest is a word part of 4 letters or more: "ground|water", not "dis|information"
        return sa == sb or (min(len(sa), len(sb)) >= 5 and (sa.startswith(sb) or sb.startswith(sa))) or (len(b) >= 4 and a.endswith(b) and len(a) - len(b) >= 4)
    FORM_TOKS = [(str(c["id"]), f, toks(f)) for c in concepts for f in [c.get("term")] + list(c.get("synonyms") or []) if f]
    GEN = {stem(g) for g in GENERAL}
    def score_of(pt, ft):
        hit = [w for w in pt if any(same(w, x) for x in ft)]
        ok = any(stem(w) not in GEN for w in hit)          # not a match on a general word or qualifier only
        return (len(hit) / max(len(pt), len(ft))) if ok else 0.0
    def closest(phrase, own=None, kept=(), head=False):
        """the closest term other than `own`; None when an existing tag (kept) or the term itself fits as well or better.
        head=True: the last word of the phrase (its main noun) must be matched ("heat-tolerant vaccine" is no variety)"""
        pt = toks(phrase)
        if not pt:
            return None
        best, own_score, kept_score = None, 0.0, 0.0
        for cid, form, ft in FORM_TOKS:
            if not ft:
                continue
            sc = score_of(pt, ft)
            if cid in kept:                                   # a tag already kept for these words: compared without the head rule
                kept_score = max(kept_score, sc); continue
            if head and not any(same(pt[-1], x) for x in ft):
                sc = 0.0
            if cid == own:
                own_score = max(own_score, sc); continue
            if sc >= 0.6 and (best is None or sc > best["score"]):
                best = {"id": cid, "term": tname.get(cid, cid), "form": form, "score": round(sc, 2)}
        if not best or best["score"] <= max(own_score, kept_score):
            return None
        return best

    TAG_KEEP = ("concept_id", "concept_name", "facet", "role_adaptation", "role_mitigation", "detection_excerpt",
                "adaptation", "adaptation_anchor_quote", "mitigation", "mitigation_anchor_quote",
                "pathway_role", "result_level", "status", "status_quote", "intervention_type", "confidence",
                "anchored_by_text", "adaptation_by_text", "mitigation_by_text")   # r17f: counted through the text's anchor, per area
    AREA_KEEP = ("information", "objective", "objective_quote", "measure", "measure_quote", "measure_kind", "purpose",
                 "purpose_basis", "purpose_quote", "claim_without_tags", "level", "rationale", "system_or_population",
                 "intervention", "result", "intervention_type", "link_rationale_intervention", "link_intervention_result",
                 "climate_function", "function_quote")   # r16: the climate function read by the AI, with its words
    RD_AREA = ("function_class", "function_words", "measure", "purpose")

    def reading_of(r):
        """r16 and later: the kind of work and, when there are two readings, what each said per area"""
        rd = r.get("reading") or {}
        if not rd.get("n_readings"):
            return None
        each = [{"kind": x.get("kind") or "",
                 **{ax: {k: (x.get(ax) or {}).get(k) for k in RD_AREA} for ax in ("adaptation", "mitigation")}}
                for x in rd.get("readings") or []]
        return {"kind_name": rd.get("kind_name") or "", "work_words": rd.get("work_words") or "",
                "n": rd.get("n_readings"), "differ": bool(rd.get("differ")), "readings": each}
    LINK_KEEP = ("area", "kind", "from_id", "from_name", "to_id", "to_name", "how", "quote")
    FIND_KEEP = ("finding_type", "phrase", "excerpt", "concept_id", "concept_name", "proposed_action", "proposed_label",
                 "facet", "area", "proposed_value", "reason", "climate_wording")
    TOP_KEEP = ("climate_area", "geography", "geography_source", "countries_in_text", "intervention_status", "result_status",
                "comparison_area", "comparison_level", "marker_outcome", "marker_outcome_reason", "marker_outcome_quote")
    hl_all, hl_fallback, prompt_set = 0, 0, set()
    results = []
    for r in recs:
        uid = str(r["unit_id"])
        ver = r.get("versions") or {}
        prompt_set.add(ver.get("prompt") or "")
        tags = []
        for t in r.get("tags") or []:
            x = {k: t.get(k) for k in TAG_KEEP}
            word = term_in(t.get("detection_excerpt") or "", t.get("concept_id"))
            hl_all += 1
            if not word:
                hl_fallback += 1
            x["hl"] = word or ""
            tags.append(x)
        kept = {t["concept_id"] for t in tags}
        dropped, seen_d = [], {}
        def narrower_kept(name, words, tags):
            # a kept tag whose name holds every word of this term (first six letters) and more, on the same words of the text
            w6 = lambda s: [w[:6] for w in re.findall(r"[a-z]+", s.lower())]
            dn, wl = w6(name), words.lower()
            for t in tags:
                kn, ex = w6(t.get("concept_name") or ""), (t.get("detection_excerpt") or "").lower()
                if wl and ex and len(kn) > len(dn) and all(w in kn for w in dn) and (wl in ex or ex in wl):
                    return t.get("concept_name") or ""
            return ""
        for d in drops.get(uid, []):
            cid = str(d.get("concept_id") or "")
            if not cid or cid in kept or d.get("reason") in NOT_TERM:
                continue
            if cid not in seen_d:
                seen_d[cid] = {"concept_id": cid, "concept_name": tname.get(cid, cid), "reasons": []}
                dropped.append(seen_d[cid])
            z = {"reason": d.get("reason") or "", "detail": d.get("detail") or ""}
            if d.get("why"):                         # script r17g: the AI's one-sentence reason
                z["why"] = d["why"]
            seen_d[cid]["reasons"].append(z)
        full = (r.get("title_en") or r.get("title") or "") + " / " + (r.get("description_en") or r.get("description") or "")
        for x in dropped:                            # where the words are in the text, for the reviewer
            given = next((z["detail"] for z in x["reasons"] if z["reason"].startswith("not_kept:") and z["detail"]), "")
            x["found_as"], x["context"] = where_in(full, x["concept_id"], given)
            nk = narrower_kept(x["concept_name"], given or x["found_as"] or "", tags)
            if nk:                                   # a narrower term is kept on the same words (Greenhouse gas emissions)
                for z in x["reasons"]:
                    if z["reason"] in ("not_kept:different_meaning", "not_kept:other", "not_kept:too_generic", "not_kept:narrower_term_tagged"):
                        z["narrower"] = nk
                continue
            if given and any(z["reason"] in ("not_kept:different_meaning", "not_kept:other", "not_kept:too_generic") for z in x["reasons"]):
                b = closest(given, own=x["concept_id"], kept=kept, head=True)
                if b:
                    x["better"] = dict(b, phrase=given)       # a better term for the same words
        res = {"id": uid, "title": r.get("title") or "", "description": r.get("description") or "",
               "marker": r.get("climate_marker") or "", "level": r.get("level") or "", "type": r.get("type") or "",
               "status": r.get("status") or "", "prompt": ver.get("prompt") or "", "translated": bool(r.get("translated")),
               "tags": tags, "links": [{k: l.get(k) for k in LINK_KEEP} for l in r.get("links") or []],
               "adaptation": {k: (r.get("adaptation") or {}).get(k) for k in AREA_KEEP},
               "mitigation": {k: (r.get("mitigation") or {}).get(k) for k in AREA_KEEP},
               "review_flags": aslist(r.get("review_flags")),
               "findings": [dict({k: f.get(k) for k in FIND_KEEP},
                                 **({"closest": closest(f.get("proposed_label") or f.get("phrase") or "")} if f.get("finding_type") == "unmatched_climate_phrase"
                                    and closest(f.get("proposed_label") or f.get("phrase") or "") else {}))
                            for f in r.get("taxonomy_findings") or []],
               "dropped": dropped}
        if r.get("english_kept"):                     # r17e: English and Spanish in the field; only the English was used
            res["english_kept"] = True
        if res["translated"] or res.get("english_kept"):   # the term search and the excerpts are on the English text
            res["title_en"], res["description_en"] = r.get("title_en") or "", r.get("description_en") or ""
        for k in TOP_KEEP:
            res[k] = r.get(k)
        if "marker_outcome_detail" in r:             # script r12 and later; the page works it out when absent
            res["marker_outcome_detail"] = r.get("marker_outcome_detail") or ""
        rdg = reading_of(r)
        if rdg:
            res["reading"] = rdg
        results.append(res)
    prompts = "; ".join(sorted(p for p in prompt_set if p))
    print("highlighting: %d of %d tag excerpts hold no term or synonym of their concept and are highlighted in full"
          % (hl_fallback, hl_all))

results.sort(key=lambda r: (not r["id"].isdigit(), int(r["id"]) if r["id"].isdigit() else 0, r["id"]))
batch_doc = {"batch": a.batch, "taxonomy": tver, "results": results}          # v4 batches: layout unchanged
if form == "v6":
    batch_doc = {"batch": a.batch, "form": form, "taxonomy": tver, "prompt": prompts, "results": results}
json.dump(batch_doc, open(os.path.join(OUT, f"batch-{a.batch}.json"), "w", encoding="utf-8"), ensure_ascii=False)

bp = os.path.join(OUT, "batches.json")
batches = json.load(open(bp, encoding="utf-8")) if os.path.exists(bp) else []
old = next((b for b in batches if b["id"] == a.batch), None)
# v / tv: short content stamps, so browsers cache the files and fetch them again only when they change
stamp = lambda f: hashlib.sha1(open(os.path.join(OUT, f), "rb").read()).hexdigest()[:10]
entry = {"id": a.batch, "name": a.name or (old or {}).get("name") or a.batch, "form": form, "taxonomy": tver,
         "taxonomy_file": tfile, "n": len(results), "v": stamp(f"batch-{a.batch}.json"), "tv": stamp(tfile)}
if prompts:
    entry["prompt"] = prompts
if old:                                              # same place in the list
    batches[batches.index(old)] = entry
else:
    batches.append(entry)
json.dump(batches, open(bp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"batch '{a.batch}' (form {form}): {len(results)} results · taxonomy {tver}: {len(terms)} terms -> {tfile}")
