# Builds docs/review/v7.js from docs/review/v6.js: the review form for batches tagged with the rules of 25 Nov 2026 (r18).
# Run from Taxonomy/4_Climate_taxonomy_repository. Every replacement must match exactly once. v6.js is not changed.
import io

s = io.open("docs/review/v6.js", encoding="utf-8", newline="").read().replace("\r\n", "\n")


def sub(old, new, n=1):
    global s
    assert s.count(old) == n, (s.count(old), old[:90])
    s = s.replace(old, new)


def between(start, end, new):
    global s
    assert s.count(start) == 1, (s.count(start), start[:90])
    i = s.index(start)
    j = s.index(end, i + len(start))
    s = s[:i] + new + s[j:]


# ================================================================ head: words, Rules 8 and 9
between("// Review form for batches tagged under the CGIAR tagging standard (form \"v6\"", "  // ---------------------------------------------------------------- the reviewer's answers", r'''// Review form for batches tagged under the CGIAR tagging standard as revised on 24 and 25 November 2026 (form "v7" in
// data/batches.json; tagging script r18 and later). Built from v6.js by review/scripts/make_v7.py: the same page, in
// the words of the standard, with question 3 on the purpose (Rule 7), the verdict (Rule 8) and the comparison with the
// assigned marker (Rule 9). Loaded before app.js; it uses the helpers of app.js ($, $$, esc, S, api, navBar, search, ...).
// The reviewer never chooses a verdict directly: the reviewer says whether a purpose is shown and which rule of Rule 8
// decides; the page works out the verdict and the comparison with the rules of the tagging script (decide_area and
// compare_marker in Taxonomy/3_Tagging/PRMS/script/PRMS_Tagging.Rmd, copied below). Change both together.
const V7 = (() => {
  const AREAS = ["adaptation", "mitigation"];
  const AX = { adaptation: "Adaptation", mitigation: "Mitigation" };
  const counts = v => v === "stand_alone" || v === "anchored";
  const isCounted = t => counts(t.adaptation) || counts(t.mitigation);
  const W = {
    stand_alone: "stand-alone", anchored: "anchored", no_anchor: "no anchor", not_relevant: "not relevant", refused: "refused", unclear: "unclear",
    rationale: "climate rationale", system_or_population: "system or population", intervention: "intervention",
    result_output: "result (output)", result_outcome: "result (outcome)", result_impact: "result (impact)",
    result_level_unclear: "result (level not clear)", none: "none",
    intended: "intended", realized: "realized", planned: "intended", carried_out_or_reported: "realized", not_applicable: "not applicable",
    shown: "shown", "not shown": "not shown", "not assessed": "not assessed", other: "other",
    rationale_to_intervention: "climate rationale to intervention", intervention_to_result: "intervention to result",
    clear_from_context: "clear from context",
    unmatched_climate_phrase: "unmatched climate phrase", doubtful_match: "doubtful match",
    possible_misclassification: "possible misclassification", unrecorded_anchor_type: "unrecorded type of climate anchor",
    intervention_without_taxonomy_term: "intervention with no taxonomy term",
    propose_term: "propose a new term", add_synonym: "add a synonym", change_classification: "change the classification",
    add_anchor_type: "add a type of climate anchor",
  };
  const w = x => x == null || x === "" ? "" : Object.prototype.hasOwnProperty.call(W, x) ? W[x] : String(x).replace(/_/g, " ");
  const cut = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const opt = (v, label, on) => `<option value="${esc(v)}" ${on ? "selected" : ""}>${esc(label)}</option>`;
  const segD = (name, value, label, on, cls, off) => `<label class="seg ${cls || ""} ${off ? "off" : ""}"><input type="radio" name="${esc(name)}" value="${esc(value)}" ${on ? "checked" : ""} ${off ? "disabled" : ""}><span>${label}</span></label>`;

  // ---------------------------------------------------------------- Rules 8 and 9, as in the tagging script (chunk "derive")
  const VERDICT = { 0: "Not targeted (0)", 1: "Significant (1)", 2: "Principal (2)" }, CANNOT = "Cannot be determined", NOT_ASSESSED = "Not assessed";
  const RULE_CODE = { N1: 0, P1: 2, P2: 2, P3: 2, P4: 2, S1: 1, S2: 1 };            // the verdict each rule of Rule 8 gives
  const RULE_WORDS = {
    N1: "N1: no purpose is shown",
    P1: "P1: the purpose comes from a named national or subnational climate plan (way 4)",
    P2: "P2: the work produces or supports a climate plan, strategy or policy, or builds capacity, tools or finance to include climate change in policy, planning or investment",
    P3: "P3: adaptation purpose through way 1 or 2, not limited to one component of the work",
    P4: "P4: mitigation purpose through way 1 or 2, not limited to one component of the work",
    S1: "S1: the purpose concerns one component of work whose stated purpose is something else",
    S2: "S2: the purpose is shown only by a reported result (way 3)",
    [CANNOT]: "Cannot be determined: a person decides using additional documents" };
  const RULE_OPTS = ax => ["N1", "P1", "P2", ax === "adaptation" ? "P3" : "P4", "S1", "S2", CANNOT].map(k => [k, RULE_WORDS[k]]);
  const WAY_WORDS = { 1: "way 1: the text states what the intervention or work is for", 2: "way 2: the intervention is described by the climate rationale",
    3: "way 3: a result of the intervention is reported in relation to the climate rationale", 4: "way 4: a named national or subnational climate plan" };
  const verdictOfRule = rule => rule === CANNOT ? { label: CANNOT, code: null } : Object.prototype.hasOwnProperty.call(RULE_CODE, rule)
    ? { label: VERDICT[RULE_CODE[rule]], code: RULE_CODE[rule] } : { label: NOT_ASSESSED, code: null };
  // "(2) Principal" -> 2, "(1) Significant" -> 1, "(0) Not targeted" -> 0, no marker -> null (never converted to 0)
  function markerCode(m) {
    m = String(m || "").trim(); if (!m) return null;
    const d = /\((\d+)\)/.exec(m); if (d) return +d[1];
    const l = m.toLowerCase();
    return l.includes("principal") ? 2 : l.includes("significant") ? 1 : l.includes("not targeted") ? 0 : null;
  }
  // Rule 9. V: {adaptation: {label, code}, mitigation: {label, code}}. One marker is assigned for adaptation and
  // mitigation together: it is compared with the higher of the two verdicts (provisional, until Andreea decides).
  function compareWith(res, V) {
    const ca = V.adaptation.code, cm = V.mitigation.code, na = ca == null, nm = cm == null;
    const hi = !na && !nm ? Math.max(ca, cm) : !na && ca === 2 ? 2 : !nm && cm === 2 ? 2 : null;
    const area = hi == null ? "" : (!na && !nm && ca === cm) ? (hi === 0 ? "none" : "both") : (!na && ca === hi) ? "adaptation" : "mitigation";
    const notAssessed = [V.adaptation.label, V.mitigation.label].includes(NOT_ASSESSED);
    const verdict = hi != null ? VERDICT[hi] : notAssessed ? NOT_ASSESSED : CANNOT;
    const text = String(res.title || "") + String(res.description || ""), c = markerCode(res.marker);
    let o;
    if (!text.trim()) o = ["Not compared", "The text is empty."];
    else if (c == null) o = ["Marker missing", "No climate marker is assigned to this text. A missing marker is not treated as 0."];
    else if (hi == null) o = ["Not compared", notAssessed ? "The reading was not done, so there is no verdict to compare." : "The verdict cannot be determined from the text. A person decides using additional documents."];
    else if (hi === c) o = ["Consistent", c === 0 ? "The assigned marker and the verdict are both Not targeted (0): this text shows no conflict. It does not confirm that the work was assessed correctly." : `The text supports ${verdict}, the assigned marker.`];
    else o = [hi < c ? "The text supports a lower marker" : "The text supports a higher marker", `The text supports ${verdict}; the assigned marker is ${VERDICT[c]}.`];
    return { adaptation: V.adaptation.label, mitigation: V.mitigation.label, area, verdict, result: o[0], reason: o[1] };
  }
  const aiV = (res, ax) => { const a = res[ax] || {}; return { label: a.verdict || VERDICT[0], code: a.verdict_code == null ? null : +a.verdict_code }; };
  // the AI's answer, as recorded
  function aiResult(res) {
    const c = compareWith(res, { adaptation: aiV(res, "adaptation"), mitigation: aiV(res, "mitigation") });
    return { ...c, verdict: res.comparison_verdict || c.verdict, area: res.comparison_area || c.area, result: res.comparison_result || c.result, reason: res.comparison_reason || c.reason };
  }

''')

# ================================================================ the reviewer's answers
between("  const TAG_FIELDS = [\"adaptation\", \"mitigation\", \"pathway_role\", \"status\"];", "  // ---------------------------------------------------------------- \"?\" toggles", r'''  const TAG_FIELDS = ["adaptation", "mitigation", "pathway_role", "status"];
  const FIELD_WORDS = { adaptation: "adaptation", mitigation: "mitigation", pathway_role: "pathway role", status: "intended or realized" };
  // "unclear" (Rule 2) is offered only for a term that is stand-alone for both areas
  const AREA_OPTS = (role, both) => role === "stand-alone" ? (both ? ["stand_alone", "not_relevant", "unclear"] : ["stand_alone", "not_relevant"])
    : role === "context-dependent" ? ["anchored", "no_anchor", "not_relevant"] : ["not_relevant"];
  const ROLE_OPTS = ["rationale", "system_or_population", "intervention", "result_output", "result_outcome", "result_impact", "result_level_unclear", "none"];
  const STATUS_OPTS = ["intended", "realized", "unclear", "not_applicable"];
  const REFUSE = [["different_meaning", "different meaning in this text"], ["other", "other (say why in the note)"]];
  // reasons no longer offered (26 Nov 2026); a saved review that holds one of them still shows it
  const REFUSE_OLD = [["too_generic", "too generic"], ["not_this_work", "not about this work"]];
  // Every question is answered the same way: Agree, or Disagree with a note; where the answer is a value from a list,
  // Disagree also asks for the right value. The answers start as extracted from the text.
  const PURPOSE_OPTS = [["shown", "a purpose is shown"], ["not shown", "no purpose is shown"]];
  const Q = () => ({ d: "agree", value: "", note: "" });
  const label = (list, v) => (list.find(x => x[0] === v) || [v, w(v)])[1];
  const DROP_WORDS = { "not_kept:other": "not kept", "not_kept:part_of_a_name": "part of a name", "not_kept:different_meaning": "different meaning in this text",
    "not_kept:too_generic": "too generic", broader_term_of_a_kept_tag: "broader term of a kept tag", excerpt_not_in_text: "wording not found in the text" };
  const dropWord = r => DROP_WORDS[r] || String(r || "").replace(/^not_kept:/, "").replace(/_/g, " ");
  const fkey = f => [f.finding_type || "", f.concept_id || "", f.phrase || ""].join("|");

  // the answers: path {d, note}; per area pu {d, value, note} (purpose, Rule 7), wy ["1".."4"] (the way or ways that show the
  // purpose, Rule 9; it starts as the ways recorded for the area; a saved review without it loads the same way) and
  // vd {d, value, note} (the rule that decides, Rule 8)
  function norm(a, res) {
    a = a && typeof a === "object" ? JSON.parse(JSON.stringify(a)) : {};
    a.areas = a.areas || {};
    AREAS.forEach(ax => { const r = a.areas[ax] = a.areas[ax] || {}; ["pu", "vd"].forEach(k => { r[k] = Object.assign(Q(), r[k] || {}); });
      r.wy = (Array.isArray(r.wy) ? r.wy : ((res || {})[ax] || {}).ways || []).map(String); });
    a.path = Object.assign(Q(), a.path || {});
    a.tags = a.tags || {}; a.added_terms = a.added_terms || []; a.added_counts = a.added_counts || {}; a.findings = a.findings || {};
    a.proposals = a.proposals || []; a.comment = a.comment || "";
    (res.tags || []).forEach(t => { if (!a.tags[t.concept_id]) a.tags[t.concept_id] = { d: "agree" }; });
    a.result_id = res.id;
    delete a.computed; delete a.basis;          // worked out again at each save
    return a;
  }
  const dec = (R, t) => (R.tags || {})[t.concept_id] || { d: "agree" };
  const val = (R, t, f) => { const d = dec(R, t); return d.d === "change" && d[f] != null ? d[f] : t[f]; };
  const tagChanged = (t, d) => !!d && (d.d === "refuse" || d.d === "change");          // Disagree counts, with or without a change
  const countsFor = (res, R, ax) => [
    ...(res.tags || []).filter(t => dec(R, t).d !== "refuse" && counts(val(R, t, ax))).map(t => ({ id: t.concept_id, name: t.concept_name, how: val(R, t, ax) })),
    ...(R.added_terms || []).filter(id => ((R.added_counts || {})[id] || {})[ax]).map(id => ({ id, name: (S.terms[id] || {}).term || id, how: "added" }))];
  const unclearOf = (res, R) => (res.tags || []).filter(t => dec(R, t).d !== "refuse" && (val(R, t, "adaptation") === "unclear" || val(R, t, "mitigation") === "unclear")
    && !counts(val(R, t, "adaptation")) && !counts(val(R, t, "mitigation")));

  const extPurpose = (res, ax) => (res[ax] || {}).purpose === "shown" ? "shown" : "not shown";
  const extRule = (res, ax) => (res[ax] || {}).rule || "";
  const noted = q => !!String(q.note || "").trim();
  // Rule 7 then Rule 8, from the reviewer's answers. Notes are optional. A purpose that is not shown gives N1; a purpose
  // that is shown needs the rule that decides.
  function reviewAreas(res, R) {
    const V = {}, P = {}, missing = [];
    AREAS.forEach(ax => {
      const r = R.areas[ax], er = extRule(res, ax);
      const purpose = r.pu.d === "disagree" ? (r.pu.value || (extPurpose(res, ax) === "shown" ? "not shown" : "shown")) : extPurpose(res, ax);
      let rule = r.vd.d === "disagree" ? r.vd.value : er;
      if (r.vd.d === "disagree" && !r.vd.value) missing.push(`${AX[ax]}, verdict: choose the rule of Rule 8 that decides.`);
      else if (!rule) missing.push(`${AX[ax]}: the verdict was not assessed. Choose Disagree on the verdict, then the rule of Rule 8 that decides.`);
      else if (purpose === "not shown" && RULE_CODE[rule] > 0) {
        if (r.vd.d === "disagree") missing.push(`${AX[ax]}: you say that no purpose is shown, so only N1 or Cannot be determined can decide.`);
        else rule = "N1";                                    // no purpose: N1 follows (Rule 8)
      }
      else if (purpose === "shown" && rule === "N1") missing.push(`${AX[ax]}: you say that a purpose is shown, so N1 cannot decide. Choose the rule of Rule 8 that decides.`);
      P[ax] = purpose; V[ax] = { ...verdictOfRule(rule || ""), rule: rule || "" };
    });
    return { V, P, missing };
  }
  // every point where the reviewer disagrees, in words, by question of the standard, for the box "What your answers give"
  function disagreements(res, R) {
    const out = [], nt = q => q.note ? ` (“${q.note}”)` : "";
    (res.tags || []).forEach(t => { const d = dec(R, t); if (tagChanged(t, d)) out.push(`Question 1, tag ${t.concept_name}: ${tagText(t, d)}`); });
    (R.added_terms || []).forEach(id => out.push(`Question 1, term added: ${(S.terms[id] || {}).term || id} (${addedHow(R, id)})`));
    if (R.path.d === "disagree") out.push("Question 2, climate pathway" + nt(R.path));
    AREAS.forEach(ax => { const r = R.areas[ax];
      if (r.pu.d === "disagree") out.push(`Question 3, ${ax} purpose (Rule 7): ${r.pu.value || (extPurpose(res, ax) === "shown" ? "not shown" : "shown")}${nt(r.pu)}`);
      if (r.vd.d === "disagree") out.push(`Question 3, ${ax} verdict (Rule 8): ${r.vd.value ? `${r.vd.value}, ${verdictOfRule(r.vd.value).label}` : "choose the rule that decides"}${nt(r.vd)}`); });
    return out;
  }
  // captured well / minor gap / wrong: wrong when a verdict or the comparison result differs from the AI's; minor gap when
  // only tags, terms, the pathway, the purpose or the rule differ; the taxonomy findings and proposals do not count
  function reviewResult(res, R) {
    const { V, P, missing } = reviewAreas(res, R), c = compareWith(res, V), ai = aiResult(res);
    let review = "";
    if (!missing.length) {
      if (c.adaptation !== ai.adaptation || c.mitigation !== ai.mitigation || c.result !== ai.result) review = "wrong";
      else {
        const minor = (res.tags || []).some(t => tagChanged(t, (R.tags || {})[t.concept_id])) || (R.added_terms || []).length > 0
          || R.path.d === "disagree" || AREAS.some(ax => R.areas[ax].pu.d === "disagree" || R.areas[ax].vd.d === "disagree");
        review = minor ? "minor gap" : "captured well";
      }
    }
    return { ...c, V, P, missing, complete: !missing.length, review };
  }
  function agree(id) {
    const v = S.others[id] || [], res = S.byId[id]; if (v.length < 2 || !res) return null;
    const [x, y] = v.slice(0, 2).map(r => reviewResult(res, norm(r.answers, res)));
    return x.adaptation === y.adaptation && x.mitigation === y.mitigation && x.result === y.result;
  }

''')

# ================================================================ help texts
between("  const HELP = {", "  // \"?\" boxes open on hover", r'''  const HELP = {
    marker: ["assigned marker", "The OECD-DAC climate marker recorded for the work by the person reporting, here in PRMS: Principal (2), Significant (1) or Not targeted (0). PRMS records one marker for adaptation and mitigation together. A missing marker is never treated as 0. The review does not change it; the verdict is compared with it."],
    verdict: ["verdict", "The outcome of Rule 8 for this area: the marker that the text supports. You do not choose it directly: it follows from the rule of Rule 8 that decides.",
      `<table class="hlp-t"><tr><th>Verdict</th><th>Rule</th></tr>
        <tr><td>Not targeted (0)</td><td>N1: no purpose is shown.</td></tr>
        <tr><td>Principal (2)</td><td>P1: the purpose comes from a named climate plan. P2: the work produces or supports a climate plan, strategy or policy, or builds capacity or tools or finance to include climate change in policy, planning or investment. P3 (adaptation), P4 (mitigation): the purpose is shown through way 1 or 2 and is not limited to one component of the work.</td></tr>
        <tr><td>Significant (1)</td><td>S1: the purpose concerns one component of work whose stated purpose is something else. S2: the purpose is shown only by a reported result (way 3).</td></tr>
        <tr><td>Cannot be determined</td><td>The text does not describe what the work did; it can be read in two ways that lead to different verdicts; or it names a climate plan that covers both areas without saying which part.</td></tr></table>`],
    "climate-information": ["climate-related information", "The taxonomy terms that count for this area: stand-alone terms (Rule 2), and context-dependent terms when the text gives a climate anchor for the area (Rule 3). If no term counts, the text holds no climate-related information for the area. A term that is stand-alone for both areas, in a text that does not show which area it concerns, has the area “unclear” and counts for neither. Change the values in the tag table."],
    purpose: ["purpose", "Rule 7. The text has an adaptation (or mitigation) purpose when it shows it in one of four ways. Way 1: the text states what the intervention or work is for. Way 2: the intervention is described by the climate rationale (“drought-tolerant maize”). Way 3: the text reports a result of the intervention in relation to the climate rationale. Way 4: the work arises from, implements or contributes to a named national or subnational climate plan. No purpose: no climate rationale; a climate rationale with no connection to an intervention; a general label (climate-smart, climate action, resilient) or a general claim (climate benefits) that names no climate rationale; a plan that is not a climate plan."],
    rule: ["rule that decides", "Rule 8. The first rule that applies gives the verdict: N1, then P1, P2, P3 or P4, then S1, S2, otherwise Cannot be determined. When two independent readings of the text lead to different verdicts, the verdict is Cannot be determined. Principal for both areas is accepted only when each rests on different quoted words."],
    tags: ["tags", "Each taxonomy term tagged in the text, with the words it was found as, its value for each area (Rules 1 to 3), its pathway role (Rule 4) and, for an intervention or a result, whether it is intended or realized (Rule 6). Agree, or disagree to correct a value, remove the tag or write a note."],
    anchors: ["tag values", "Stand-alone: the term is climate-related information on its own. Anchored: a context-dependent term that counts because the text gives a climate anchor for the area; point at the value to see the sentence. No anchor: the text gives no climate anchor for the area. Not relevant: the term does not concern this area. Unclear: a term that is stand-alone for both areas, in a text that does not show which area it concerns."],
    colours: ["colours in the text", "Yellow: a tag that counts as climate-related information (a stand-alone term, or a context-dependent term with a climate anchor). Grey: a tag that does not count (a context-dependent term with no climate anchor, or a term with an unclear area). Blue: a term added by you. Purple, dotted: a proposed tag, words that no taxonomy term covers (decided under question 4). Words found but not tagged are not coloured. Only the taxonomy term or synonym is coloured, at its place in the text; click a colour to find its row."],
    "terms-not-kept": ["words found but not tagged", "A search marks every word of the text that matches a taxonomy term or synonym. Some become tags, others are left out. These are the ones left out, with where they are in the text and why. If one should be a tag, click + keep."],
    "add-term": ["add a term", "Use this when the text holds a taxonomy term that was not tagged. Search the taxonomy by term or synonym (or select the words in the text), click + add, then tick the area for which the term counts. If the words are not in the taxonomy, propose them: they go to question 4."],
    pathway: ["climate pathway", "Rules 4 and 5. The five components of the climate pathway for each area, from the tags that count: climate rationale, geography, system or population, intervention and result, and the relationships (links) the text gives between them. The system or population is the one exposed or vulnerable to the climate issue; an organisation that carries out the work is not the system or population. Agree, or disagree (a note on which part is wrong is optional)."],
    flags: ["flags", "Points the tagging script asks a person to look at first, for example two readings of the text that lead to different verdicts. A flag is not an error."],
    comparison: ["comparison with the assigned marker", "Rule 9. Consistent: the verdict and the assigned marker are the same. The text supports a lower marker: the assigned marker is higher. The text supports a higher marker: the assigned marker is lower. Marker missing: no marker is assigned. Not compared: the verdict cannot be determined. PRMS records one marker for both areas, so it is compared with the higher of the two verdicts. The result is a signal for review; it does not replace the assigned marker."],
    outcome: ["outcome of the review", "Worked out from your answers. Wrong when a verdict or the comparison result differs from the extracted one; minor gap when only tags, terms, the pathway, the purpose or the rule differ; captured well when nothing differs."],
    proposals: ["proposed terms", "Rules 10 to 12. Wording that the taxonomy lacks, as a new term or as a synonym of an existing term: the ones found in the text (accept or reject each) and your own. They go to the people who maintain the taxonomy and do not change the outcome of your review."],
  };
''')
sub('''<a href="rules.html#${esc(key)}" target="_blank" rel="noopener">More information</a>''', '''<a href="rules7.html#${esc(key)}" target="_blank" rel="noopener">More information</a>''')

# ================================================================ small pieces of display
sub('''  const lvPill =(lv, purpose) => lv ? `<span class="lv lv-${esc(lv)}" title="${esc(levelWords(lv, purpose))}">${esc(lv)}</span>` : "";
  const levelCell = (lv, purpose) => `${lvPill(lv, purpose)} <span class="small">${esc(levelWords(lv, purpose))}</span>`;
  const markerCell = (o, d) => o ? `<span class="oc oc-${esc(o.replace(/ /g, "-"))}">${esc(outcomeLabel(o, d))}</span>` : "";''',
    '''  const VD_CLASS = { "Principal (2)": "L3", "Significant (1)": "L2", "Not targeted (0)": "L0", "Cannot be determined": "cannot" };          // the colours of the page, reused
  const verdictCell = (label, rule) => label ? `<span class="lv lv-${VD_CLASS[label] || "L1"}">${esc(label)}</span>${rule && rule !== label ? ` <span class="small">by ${esc(rule)}</span>` : ""}` : "";
  const CMP_CLASS = { "Consistent": "aligned", "The text supports a lower marker": "marker-higher", "The text supports a higher marker": "marker-lower", "Marker missing": "no-comparison", "Not compared": "cannot-determine" };
  const cmpCell = o => o ? `<span class="oc oc-${CMP_CLASS[o] || "no-comparison"}">${esc(o)}</span>` : "";''')
sub('''You can read the results; nothing can be saved''', '''You can read the texts; nothing can be saved''')
sub('''key: "path", or "fn-", "me-", "pu-" followed by the area.''', '''key: "path", or "pu-" (purpose) or "vd-" (verdict) followed by the area.''')
between("  // what the two readings said for one area and one field, when they differ", "  // proposed tags: new climate terms", r'''  // what the two readings gave for one area, when they lead to different verdicts
  function readingsDiffer(res, ax) {
    const a = res[ax] || {};
    return (res.reading || {}).differ && a.cannot_reason === "two readings" ? String(a.verdict_reason || "") : "";
  }
''')
sub('''<span class="k hc">tag that counts</span><span class="k hg">tag that does not count</span>''', '''<span class="k hc">tag that counts</span><span class="k hg">tag that does not count</span>''')
sub('''The PRMS text gives the same text in English and in Spanish''', '''The source gives the same text in English and in Spanish''')

# ================================================================ list
sub('''"Each row is one PRMS result with its PRMS climate marker"}''', '''"Each row is one text (a PRMS result) with its assigned marker"}''')
sub('''title="Sort by PRMS marker: Principal, Significant, Not targeted, not provided; click again to reverse">PRMS marker${arrow}</button>''',
    '''title="Sort by assigned marker: Principal, Significant, Not targeted, not provided; click again to reverse">Assigned marker${arrow}</button>''')

# ================================================================ the form
between('''      <section class="card intro" id="v6-intro">''', '''    const mk = $(".nav .meta span");                   // the PRMS marker in the header line''', r'''      <section class="card intro" id="v6-intro"><p><b>The review follows the four questions of the tagging standard.</b> The answers start as extracted from the text: agree, or disagree (choose the right answer where there is a list; the note is optional). Each disagreement shows at once in the yellow box at the end. Then submit.
        <a href="rules7.html#what-to-do" target="_blank" rel="noopener">How to review a text</a> · <a href="rules7.html#definitions" target="_blank" rel="noopener">Definitions</a></p>
        <div class="flags small" id="v6-flags"><b>Flags</b> ${help("flags")} ${(res.review_flags || []).length ? res.review_flags.map(f => `<span class="flag">${esc(f)}</span>`).join("") : `<span class="muted">none</span>`}</div></section>
      ${qHead(1, "What climate-related information does the text contain?", "Rules 1 to 3: the taxonomy terms in the text, and whether they concern adaptation, mitigation, both or neither. The table also gives the pathway role of each term (Rule 4) and, for an intervention or a result, whether it is intended or realized (Rule 6).")}
      <section class="card flush" id="v6-tags"></section>
      <section class="card" id="v6-info"></section>
      <section class="card" id="v6-dropped"></section>
      <section class="card" id="v6-add"><h3>Add a term ${help("add-term")}</h3>
        <div class="small muted">For a taxonomy term that is in the text and was not tagged. Search the taxonomy, click + add, then tick the area for which the term counts.</div>
        <input id="q" class="search" placeholder="Search terms and synonyms" autocomplete="off">
        <div id="hits" class="hits"></div>
        <div id="added" class="chips"></div>
        <a href="#" id="brw" class="small">Browse the taxonomy</a>
        <div id="tree" class="tree" hidden></div></section>
      ${qHead(2, "What climate pathway does the text describe?", "Rules 4 and 5: climate rationale, geography, system or population, intervention and result, and the relationships between them")}
      <section class="card" id="v6-path"></section>
      ${qHead(3, "Is the information consistent with the assigned climate marker?", `Rules 7 to 9, for adaptation and for mitigation: whether the text shows a purpose (Rule 7), the verdict and the rule that decides (Rule 8), then the comparison of the verdict with the assigned marker <b>${esc(res.marker || (res.part ? "none: a plan carries no marker" : "not provided"))}</b> (Rule 9). The comparison is in the yellow box at the end.`)}
      ${AREAS.map(ax => `<section class="card area" id="v6-area-${ax}"></section>`).join("")}
      ${qHead(4, "What gaps or errors in the taxonomy does tagging reveal?", "Rules 10 to 12: wording of the text that the taxonomy lacks, as a new term or as a synonym. Accept or reject each proposal found in the text, and add your own. Proposals go to the taxonomy reviewers; they are not tags and do not change the verdict.")}
      <section class="card" id="v6-props"><h3>Proposed tags and new terms ${help("proposals")}</h3>
        <div class="small muted">Words of the text that no taxonomy term covers, found by the tagging. They do not count as climate-related information. Decide each one here.</div><div id="v6-found"></div>
        <div class="small muted" style="margin-top:10px">Your proposals (search under Add a term in question 1; if the term is not in the taxonomy, propose it there)</div><div id="props" class="chips"></div></section>
      <section class="card" id="v6-comment"><h3>Comment</h3><textarea id="cm" placeholder="Anything the others should know">${esc(R.comment || "")}</textarea></section>
      <section class="card gives final" id="v6-gives"><h3>What your answers give <span class="small muted">(the final decision for this text)</span></h3><div id="v6-gives-b"></div></section>
      <div class="actions"><span id="msg" class="small"></span><button id="save">Save draft</button><button class="primary" id="sub">Submit</button></div>
    </div></div>`;
''')
sub('''    const mk = $(".nav .meta span");                   // the PRMS marker in the header line, with its "?"''', '''    const mk = $(".nav .meta span");                   // the assigned marker in the header line, with its "?"''')

between("  // answer to question 1: the terms that count for each area", "  function renderPath() {", r'''  // answer to question 1, in one line under the tags: the area of the climate-related information in the text
  function renderInfo() {
    const res = S.cur, R = S.rev;
    const has = Object.fromEntries(AREAS.map(ax => [ax, countsFor(res, R, ax).length > 0])), unc = unclearOf(res, R);
    const area = has.adaptation && has.mitigation ? "adaptation and mitigation" : has.adaptation ? "adaptation" : has.mitigation ? "mitigation"
      : unc.length ? "an unclear area" : "neither adaptation nor mitigation";
    $("#v6-info").innerHTML = `<div class="small">Answer to question 1 ${help("climate-information")}: the text contains climate-related information on <b>${area}</b>. <span class="muted">It follows from the tags above; change them there.</span>
      ${unc.length ? `<div class="muted">Stand-alone terms with an unclear area (Rule 2): ${unc.map(t => esc(t.concept_name)).join(", ")}.</div>` : ""}</div>`;
  }

  // near Submit, always open in a yellow frame (the final decision): the verdicts and the comparison that follow from the
  // answers (computed, not answered), and a summary of the answers by question of the standard
  function renderGives() {
    const res = S.cur, R = S.rev, ai = aiResult(res), me = reviewResult(res, R), box = $("#v6-gives-b");
    if (!box) return;
    const d = (a, b) => a !== b ? "diff" : "", dis = disagreements(res, R);
    const marker = esc(res.marker || (res.part ? "none: a plan carries no marker" : "not provided"));
    const nTags = (res.tags || []).length, nTagCh = (res.tags || []).filter(t => tagChanged(t, (R.tags || {})[t.concept_id])).length;
    const f = res.findings || [], nDec = f.filter(z => (R.findings || {})[fkey(z)]).length;
    const q3 = AREAS.map(ax => { const r = R.areas[ax], n = (r.pu.d === "disagree") + (r.vd.d === "disagree"); return `${ax}: ${n ? `you disagree on ${n === 2 ? "the purpose and the verdict" : r.pu.d === "disagree" ? "the purpose" : "the verdict"}` : "you agree"}`; }).join("; ");
    box.innerHTML = `<p class="small muted">The verdicts and the comparison are worked out from your answers with the rules of the standard (Rules 8 and 9). You do not set them here.</p>
      <table class="lvl"><thead><tr><th></th><th>Tagged by AI</th><th>Your answers</th></tr></thead><tbody>
      ${AREAS.map(ax => `<tr><th>${AX[ax]} verdict ${ax === "adaptation" ? help("verdict") : ""}</th><td>${verdictCell(ai[ax], extRule(res, ax))}</td><td class="${d(ai[ax], me[ax])}">${verdictCell(me[ax], me.V[ax].rule)}</td></tr>`).join("")}
      <tr class="pm"><th>Assigned marker ${help("marker")}</th><td>${marker}</td><td>${marker}</td></tr>
      <tr><th>Comparison ${help("comparison")}</th><td>${cmpCell(ai.result)}</td><td class="${d(ai.result, me.result)}">${cmpCell(me.result)}</td></tr>
      </tbody></table>
      <p class="small">${esc(me.reason)}</p>
      ${me.V.adaptation.code === 2 && me.V.mitigation.code === 2 ? `<div class="notice small">Principal for both is accepted only if each rests on different quoted words.</div>` : ""}
      <div class="small"><b>Summary of your answers</b>
        <ul><li>Question 1, climate-related information: ${nTags} tag${nTags === 1 ? "" : "s"}, ${nTagCh ? `${nTagCh} corrected or removed` : "all agreed"}${(R.added_terms || []).length ? `, ${R.added_terms.length} term${R.added_terms.length > 1 ? "s" : ""} added` : ""}.</li>
        <li>Question 2, climate pathway: ${R.path.d === "disagree" ? "you disagree" : "you agree"}.</li>
        <li>Question 3, purpose and verdict: ${q3}.</li>
        <li>Question 4, taxonomy: ${f.length ? `${nDec} of ${f.length} proposal${f.length > 1 ? "s" : ""} found in the text decided` : "no proposal found in the text"}${(R.proposals || []).length ? `, ${R.proposals.length} of your own` : ""}.</li></ul></div>
      <div class="small dis"><b>${dis.length ? `You disagree on ${dis.length} point${dis.length > 1 ? "s" : ""}` : "You agree with everything extracted"}</b>
        ${dis.length ? `<ul>${dis.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>
      ${me.missing.length ? `<div class="small bad"><b>Still to answer before submitting</b><ul class="missing">${me.missing.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${me.complete ? `<div class="outcome">Outcome of your review: <span class="rv rv-${esc(me.review.replace(/ /g, "-"))}">${esc(me.review)}</span> ${help("outcome")}</div>` : ""}`;
  }

  // question 3, one area: the purpose (Rule 7), then the verdict and the rule that decides (Rule 8)
  function renderArea(ax) {
    const res = S.cur, R = S.rev, ai = res[ax] || {}, r = R.areas[ax], me = reviewResult(res, R);
    let h = `<div class="ah"><span class="ax">${AX[ax]}</span> <span class="small muted">Rule 7: the purpose. Rule 8: the verdict</span></div>`;
    // Rule 7: is a purpose shown, in which way, with which words
    const wq = ai.way_quotes || {}, ways = (ai.ways || []).map(String);
    const how = ways.map(k => `<div class="small">${esc(WAY_WORDS[k] || "way " + k)}: “${esc(cut(wq["way" + k] || "", 220))}”</div>`).join("")
      || (ai.policy_quote ? `<div class="small">for P2: “${esc(cut(ai.policy_quote, 220))}”</div>` : "");
    const pShown = (ai.purpose === "shown" ? `<b>${ax} purpose shown</b>${how}` : ai.purpose === "not assessed" ? `<span class="muted">not assessed: the reading was not done</span>` : `<b>no ${ax} purpose shown</b>`)
      + (ai.rationale_quote ? `<div class="small muted">Climate rationale: “${esc(cut(ai.rationale_quote, 200))}”</div>` : "");
    h += question("pu-" + ax, `Does the text have ${ax === "adaptation" ? "an adaptation" : "a mitigation"} purpose?`, "purpose", pShown, r.pu, PURPOSE_OPTS);
    // Rule 9 records the way that showed the purpose: asked when the reviewer's answer is that a purpose is shown
    if (me.P[ax] === "shown") h += `<div class="q1"><div class="small">Way or ways that show the ${ax} purpose (Rule 7, ways 1 to 4; several can apply)</div>
      ${Object.keys(WAY_WORDS).map(k => `<div><label class="small"><input type="checkbox" data-k="way-${k}" data-ax="${ax}" ${r.wy.includes(k) ? "checked" : ""}> ${esc(WAY_WORDS[k])}</label></div>`).join("")}</div>`;
    // Rule 8: the verdict and the rule that decides, with the words it rests on
    const diff = readingsDiffer(res, ax);
    const vShown = (ai.verdict ? `${verdictCell(ai.verdict, ai.rule)}` : `<span class="muted">not assessed</span>`)
      + (ai.rule && RULE_WORDS[ai.rule] && ai.rule !== CANNOT ? `<div class="small">${esc(RULE_WORDS[ai.rule])}</div>` : "")
      + (ai.rule_quote ? `<div class="small">“${esc(cut(ai.rule_quote, 240))}”</div>` : "")
      + (ai.verdict_reason ? `<div class="small muted">${esc(ai.verdict_reason)}</div>` : "")
      + (diff ? `<div class="small muted">The two readings of the text differ, so the verdict is Cannot be determined. Choose the rule that decides if the text is clear to you.</div>` : "")
      + (me.V[ax].label !== (ai.verdict || "") ? `<div class="small you">With your answers: ${esc(me.V[ax].label)}${me.V[ax].rule && me.V[ax].rule !== me.V[ax].label ? " by " + esc(me.V[ax].rule) : ""}</div>` : "");
    h += question("vd-" + ax, "Verdict, and the rule that decides", "rule", vShown, r.vd, RULE_OPTS(ax));
    $("#v6-area-" + ax).innerHTML = h;
  }
''')

between('''      <tr><th>Reason</th><td>${L(A.rationale)}</td><td>${L(M.rationale)}</td></tr>''', '''      </tbody></table>`;
  }

  function areaCell(t, ax, d) {''', '''      <tr><th>Climate rationale</th><td>${L(A.rationale)}</td><td>${L(M.rationale)}</td></tr>
      <tr><th>Geography</th><td colspan="2">${geo}${cit}</td></tr>
      <tr><th>System or population</th><td>${L(A.system_or_population)}</td><td>${L(M.system_or_population)}</td></tr>
      <tr><th>Intervention</th><td>${L(A.intervention)}${type(A)}</td><td>${L(M.intervention)}${type(M)}</td></tr>
      <tr><th>Result</th><td>${L(A.result)}</td><td>${L(M.result)}</td></tr>
      <tr><th>Links</th><td>${links("adaptation")}</td><td>${links("mitigation")}</td></tr>
''')
sub('''    const st = x => x ? esc(x) : `<span class="muted">not described</span>`;
''', '')
sub('''`anchored by the text: the text holds climate information for ${ax}${q ? `: “${q}”` : ""}`''', '''`anchored by the text: the text holds climate-related information for ${ax}${q ? `: “${q}”` : ""}`''')
sub('''          : `<label>Adaptation ${sel("adaptation", AREA_OPTS(t.role_adaptation))}</label><label>Mitigation ${sel("mitigation", AREA_OPTS(t.role_mitigation))}</label>
             <label>Role in the text ${sel("pathway_role", ROLE_OPTS)}</label><label>Planned or done ${sel("status", STATUS_OPTS)}</label>`}''',
    '''          : `<label>Adaptation ${sel("adaptation", AREA_OPTS(t.role_adaptation, bothSA))}</label><label>Mitigation ${sel("mitigation", AREA_OPTS(t.role_mitigation, bothSA))}</label>
             <label>Pathway role ${sel("pathway_role", ROLE_OPTS)}</label><label>Intended or realized ${sel("status", STATUS_OPTS)}</label>`}''')
sub('''REFUSE.map(([v, l]) => opt(v, l, d.reason === v))''', '''[...REFUSE, ...REFUSE_OLD.filter(x => x[0] === d.reason)].map(([v, l]) => opt(v, l, d.reason === v))''')
sub('''label(REFUSE, d.reason)''', '''label([...REFUSE, ...REFUSE_OLD], d.reason)''')
sub('''    // Disagree: correct a value, or remove the tag (with the reason), and a note
    const dis = d.d === "change" || d.d === "refuse";''', '''    // Disagree: correct a value, or remove the tag (with the reason), and a note
    const dis = d.d === "change" || d.d === "refuse", bothSA = t.role_adaptation === "stand-alone" && t.role_mitigation === "stand-alone";''')
sub('''  const whyNot = (t, ax, v) => v === "no_anchor" ? { k: 2, s: `for ${ax}, the text does not link it to climate` }''',
    '''  const whyNot = (t, ax, v) => v === "unclear" ? { k: 0, s: `stand-alone for both areas, and the text does not show which area it concerns` }
    : v === "no_anchor" ? { k: 2, s: `for ${ax}, the text gives no climate anchor` }''')
sub('''  const whyPhrase = (R, t) => AREAS.map(ax => whyNot(t, ax, val(R, t, ax))).sort((a, b) => a.k - b.k).map(x => x.s).join("; ");''',
    '''  const whyPhrase = (R, t) => [...new Set(AREAS.map(ax => whyNot(t, ax, val(R, t, ax))).sort((a, b) => a.k - b.k).map(x => x.s))].join("; ");''')
sub('''<th>Adaptation</th><th>Mitigation</th><th>Role in the text</th><th>Planned or done</th><th></th></tr></thead>`;''',
    '''<th>Adaptation</th><th>Mitigation</th><th>Pathway role</th><th>Intended or realized</th><th></th></tr></thead>`;''')
between('''      <div class="hint small pad">A tag counts only when an area says stand-alone or anchored''', '''      <div class="hint small pad">Agree, or Disagree to correct a value''', '''      <div class="hint small pad">A tag counts only when an area says stand-alone or anchored ${help("anchors")}. No anchor, not relevant or unclear: the term is tagged but does not count as climate-related information for an area. ${help("tags")}</div>
      <h4 class="pad grp">Tags that count as climate-related information <span class="muted">${yes.length}</span></h4>
      <div class="hint small pad">Stand-alone terms (Rule 2), and context-dependent terms with a climate anchor in the text (Rule 3).</div>
      <table class="tags v6t">${head}<tbody>${yes.map(t => tagRow(t, dec(R, t))).join("") || `<tr><td colspan="7" class="muted">None.</td></tr>`}</tbody></table>
      <h4 class="pad grp">Tags that do not count <span class="muted">${no.length}</span></h4>
      <div class="hint small pad">These terms are in the text with their taxonomy meaning (maize is maize), so they are tags. A context-dependent term with no climate anchor is kept as a general tag and is not counted as climate-related information (Rule 3). A term that is stand-alone for both areas, in a text that does not show which area it concerns, has the area unclear (Rule 2).</div>${groupWhy}
      <table class="tags v6t nocount">${head}<tbody>${no.map(t => tagRow(t, dec(R, t), why(t))).join("") || `<tr><td colspan="7" class="muted">None.</td></tr>`}</tbody></table>
''')
sub('''      case "not_kept:part_of_a_name": return "The words are part of a name (a programme, project, organisation, event or publication), so they are not climate information about the work.";''',
    '''      case "not_kept:part_of_a_name": return "The words are part of a name. Since 26 November 2026 a term inside a name counts like any other match: if this term applies, click + keep.";''')
sub('''      case "second_check:not_present": return `A second check said the term is not in the text${d ? `: ${esc(cut(d, 140))}` : "."}`;
''', '')
sub('''      case "anchor_without_climate_information": return "It was linked to a passage that holds no climate words, so it was not kept.";
''', '')
sub('''it is not that concept here (random forest is an algorithm, not a forest), it is part of a name, or a narrower term''', '''it is not that concept here (random forest is an algorithm, not a forest), or a narrower term''')
sub('''      case "measure_without_intervention_term": return `A term for the measure “${esc(cut(f.phrase, 90))}”${closest ? ` <span class="muted">(closest terms: ${esc(closest)})</span>` : ""}`;''',
    '''      case "intervention_without_taxonomy_term": case "measure_without_intervention_term": return `A term for the intervention “${esc(cut(f.phrase, 90))}”${closest ? ` <span class="muted">(closest terms: ${esc(closest)})</span>` : ""}`;''')
sub('''→ new kind of climate anchor: <b>''', '''→ new type of climate anchor: <b>''')

# ================================================================ save
sub('''      else if (k.startsWith("added-")) { (R.added_counts[el.dataset.id] ||= {})[k.slice(6)] = el.checked; refreshAll(); }
''', '''      else if (k.startsWith("added-")) { (R.added_counts[el.dataset.id] ||= {})[k.slice(6)] = el.checked; refreshAll(); }
      else if (k.startsWith("way-")) { const r = R.areas[el.dataset.ax], n = k.slice(4); r.wy = Object.keys(WAY_WORDS).filter(x => x === n ? el.checked : r.wy.includes(x)); }
''')
sub('''    const row = { result_id: res.id, batch_id: S.batch, submitted: submit || !!(was && was.submitted), answers };
''', '''    AREAS.forEach(ax => { if (me.P[ax] !== "shown") delete answers.areas[ax].wy; });          // the ways are kept only with a purpose that is shown
    const row = { result_id: res.id, batch_id: S.batch, submitted: submit || !!(was && was.submitted), answers };
''')
sub('''      computed: { adaptation_level: me.adaptation, mitigation_level: me.mitigation, comparison_area: me.area, comparison_level: me.level,
                  marker_outcome: me.marker, marker_outcome_detail: me.detail, review_outcome: me.review, complete: me.complete },''',
    '''      computed: { adaptation_verdict: me.adaptation, adaptation_rule: me.V.adaptation.rule, mitigation_verdict: me.mitigation, mitigation_rule: me.V.mitigation.rule,
                  comparison_verdict: me.verdict, comparison_area: me.area, comparison_result: me.result, review_outcome: me.review, complete: me.complete },''')

# ================================================================ answers in words, both reviews, the file
between("  function measureText(res, a, ax) {", "  const pathText = a =>", r'''  const purposeText = (res, a, ax) => { const r = a.areas[ax], ext = extPurpose(res, ax);
    return qText(r.pu, ext, r.pu.value || (ext === "shown" ? "not shown" : "shown")); };
  const ruleText = (res, a, ax) => { const r = a.areas[ax]; return qText(r.vd, extRule(res, ax) || "not assessed", r.vd.value); };
''')
between("  const aiMeasure = (res, ax) =>", "  const proposalText = p =>", r'''  const aiPurpose = (res, ax) => { const a = res[ax] || {}, ways = (a.ways || []).map(String), wq = a.way_quotes || {};
    return a.purpose === "shown" ? "shown" + (ways.length ? ` (${ways.map(k => `way ${k}: “${wq["way" + k] || ""}”`).join("; ")})` : a.policy_quote ? ` (for P2: “${a.policy_quote}”)` : "") : a.purpose || "not shown"; };
  const aiRule = (res, ax) => { const a = res[ax] || {}; return [a.rule || "not assessed", a.rule_quote ? `“${a.rule_quote}”` : ""].filter(Boolean).join(" "); };
''')
between("  function compare(res) {", "  // ---------------------------------------------------------------- the file: one row per PRMS result", r'''  function compare(res) {
    const v = (S.others[res.id] || []).slice(0, 2), ai = aiResult(res);
    const A = v.map(r => norm(r.answers, res)), C = A.map(a => reviewResult(res, a)), ag = agree(res.id);
    const cell = (x, y) => x === y ? "same" : "diff";
    const row = (th, aiH, vals, raw) => `<tr><th>${th}</th><td class="small">${aiH}</td>${vals.map(x => `<td class="${cell(raw ? raw[0] : vals[0], raw ? raw[1] : vals[1])} small">${x}</td>`).join("")}</tr>`;
    const addedAll = [...new Set(A.flatMap(a => a.added_terms || []))];
    const sec = t => `<tr class="sec"><th colspan="4">${t}</th></tr>`;
    $("#main").innerHTML = navBar(res) + `<div class="notice ${ag ? "good" : ""}">${ag ? "The two reviewers agree on the verdicts and on the comparison with the assigned marker." : "The two reviewers differ on a verdict or on the comparison with the assigned marker. Differences are marked in red."}</div>
    <div class="cols">${textBlock(res, addedAll)}<div class="side"><section class="card flush">
      <table class="cmp"><thead><tr><th></th><th>Extracted</th><th>${esc(v[0].reviewer)}</th><th>${esc(v[1].reviewer)}</th></tr></thead><tbody>
      ${AREAS.map(ax => row(AX[ax] + " verdict" + (ax === "adaptation" ? " " + help("verdict") : ""), verdictCell(ai[ax], extRule(res, ax)), C.map(c => verdictCell(c[ax], c.V[ax].rule)), C.map(c => c[ax]))).join("")}
      ${row("Comparison with the assigned marker " + help("comparison"), cmpCell(ai.result), C.map(c => cmpCell(c.result)), C.map(c => c.result))}
      ${row("Outcome of the review " + help("outcome"), "", C.map(c => esc(c.review || "incomplete")))}
      ${AREAS.map(ax => sec(AX[ax]) + row("Purpose (Rule 7)", esc(aiPurpose(res, ax)), A.map(a => esc(purposeText(res, a, ax))))
        + row("Rule that decides (Rule 8)", esc(aiRule(res, ax)), A.map(a => esc(ruleText(res, a, ax))))).join("")}
      ${sec("Tags")}
      ${(res.tags || []).map(t => row(`${esc(t.concept_name)} <span class="muted small">${esc(t.facet)}</span>`, esc([w(t.adaptation), w(t.mitigation)].join(" / ")), A.map(a => esc(tagText(t, dec(a, t)))))).join("") || `<tr><td colspan="4" class="muted">None.</td></tr>`}
      ${sec("Terms added")}
      ${addedAll.length ? addedAll.map(id => row(esc((S.terms[id] || {}).term || id), "", A.map(a => (a.added_terms || []).includes(id) ? esc("added, " + addedHow(a, id)) : ""))).join("") : `<tr><td colspan="4" class="muted">None.</td></tr>`}
      ${sec("Proposed terms and synonyms found in the text")}
      ${(res.findings || []).map(f => row(findingLine(f), "", A.map(a => esc(fdecText(a, f))))).join("") || `<tr><td colspan="4" class="muted">None.</td></tr>`}
      ${sec("Climate pathway, proposals and comments")}
      ${row("Climate pathway", "", A.map(a => esc(pathText(a))))}
      ${row("Proposals", "", A.map(a => (a.proposals || []).map(p => esc(proposalText(p))).join("<br>") || "none"))}
      ${row("Comment", "", A.map(a => esc(a.comment || "none")))}
      </tbody></table></section></div></div>`;
    const mk = $(".nav .meta span"); if (mk) mk.insertAdjacentHTML("beforeend", " " + help("marker"));
    wireMarks();
  }

''')
between("  // ---------------------------------------------------------------- the file: one row per PRMS result", "    const sheet = (h, r, wide) =>", r'''  // ---------------------------------------------------------------- the file: one row per text
  async function exportFile() {
    const link = $("#exp"), lab = link.textContent; link.textContent = "Preparing…";
    let revs;
    try { [revs] = await Promise.all([api(`/export?batch=${encodeURIComponent(S.batch)}`), loadXlsx(), S.termsReady]); }
    catch (e) { link.textContent = lab; return alert(e.message); }
    const by = {}; revs.forEach(r => (by[r.result_id] ||= []).push(r));
    const RV = ["reviewer", "status", "adaptation verdict", "adaptation rule", "mitigation verdict", "mitigation rule", "comparison result", "review outcome",
                "adaptation purpose", "mitigation purpose", "tags removed", "tags changed", "terms added",
                "proposals accepted", "proposals rejected", "proposals with no answer", "climate pathway", "proposed new terms / synonyms", "comment", "date"];
    const fdec = fdecText;
    const one = (r, res) => {
      if (!r) return Array(RV.length).fill("");
      const a = norm(r.answers, res), c = reviewResult(res, a), f = res.findings || [];
      // accepted proposals include those accepted as a synonym of the closest existing term
      const fd = x => f.filter(z => x === "accept" ? (fdec(a, z) === "accept" || fdec(a, z).startsWith("synonym of")) : fdec(a, z) === x)
        .map(z => `${w(z.finding_type)}: ${z.phrase || z.concept_name || ""}${fdec(a, z).startsWith("synonym of") ? " → " + fdec(a, z) : ""}`).join("; ");
      const inc = x => c.complete ? x : "incomplete";
      return [r.reviewer, r.submitted ? "submitted" : "draft",
        inc(c.adaptation), inc(c.V.adaptation.rule), inc(c.mitigation), inc(c.V.mitigation.rule), inc(c.result), c.review,
        purposeText(res, a, "adaptation"), purposeText(res, a, "mitigation"),
        (res.tags || []).filter(t => dec(a, t).d === "refuse").map(t => `${t.concept_name}: ${tagText(t, dec(a, t)).replace(/^removed:? ?/, "") || "no reason"}`).join("; "),
        (res.tags || []).filter(t => dec(a, t).d === "change" && tagChanged(t, dec(a, t))).map(t => `${t.concept_name}: ${tagText(t, dec(a, t)).replace(/^changed: /, "")}`).join("; "),
        addedText(a).join("; "), fd("accept"), fd("reject"), fd("no answer"), pathText(a), (a.proposals || []).map(proposalText).join("; "),
        a.comment || "", r.updated_at || ""];
    };
    const names = (res, ax) => (res.tags || []).filter(t => counts(t[ax])).map(t => `${t.concept_name} (${w(t[ax])})`).join("; ");
    const head = ["text_id", "assigned_marker", "level", "type", "title", "description", "extracted adaptation verdict", "extracted adaptation rule",
      "extracted mitigation verdict", "extracted mitigation rule", "extracted comparison result", "extracted comparison reason",
      "extracted adaptation terms that count", "extracted mitigation terms that count", "extracted adaptation purpose", "extracted mitigation purpose", "review flags",
      "review status", "reviewers agree", ...RV.map(c => "R1 " + c), ...RV.map(c => "R2 " + c)];
    const tagHead = ["text_id", "term", "concept_id", "facet", "found as", "extracted adaptation", "extracted mitigation", "extracted pathway role", "extracted intended or realized",
                     "R1 reviewer", "R1 decision", "R2 reviewer", "R2 decision"];
    const findHead = ["text_id", "finding type", "phrase", "term", "proposed action", "proposed label", "facet", "area", "reason", "passage",
                      "R1 reviewer", "R1 decision", "R2 reviewer", "R2 decision"];
    const rows = [], tagRows = [], findRows = [];
    S.list.forEach(res => {
      const v = (by[res.id] || []).slice(0, 2), sub = v.filter(r => r.submitted).length, ag = sub >= 2 ? agree(res.id) : null, ai = aiResult(res);
      const A = v.map(r => norm(r.answers, res));
      rows.push([res.id, res.marker, res.level, res.type, res.title, res.description, ai.adaptation, aiRule(res, "adaptation"), ai.mitigation, aiRule(res, "mitigation"),
        ai.result, ai.reason, names(res, "adaptation"), names(res, "mitigation"), aiPurpose(res, "adaptation"), aiPurpose(res, "mitigation"), (res.review_flags || []).join("; "),
        sub >= 2 ? "2 reviews" : sub === 1 ? "1 review" : v.length ? "in progress" : "not reviewed", ag === null ? "" : ag ? "yes" : "no",
        ...one(v[0], res), ...one(v[1], res)]);
      const rv = i => v[i] ? v[i].reviewer : "";
      (res.tags || []).forEach(t => tagRows.push([res.id, t.concept_name, t.concept_id, t.facet, t.detection_excerpt, w(t.adaptation), w(t.mitigation),
        w(t.pathway_role), w(t.status), rv(0), A[0] ? tagText(t, dec(A[0], t)) : "", rv(1), A[1] ? tagText(t, dec(A[1], t)) : ""]));
      [...new Set(A.flatMap(a => a.added_terms || []))].forEach(id => tagRows.push([res.id, (S.terms[id] || {}).term || id, id, (S.terms[id] || {}).facet || "",
        "", "", "", "", "", rv(0), A[0] && A[0].added_terms.includes(id) ? "added, " + addedHow(A[0], id) : "",
        rv(1), A[1] && A[1].added_terms.includes(id) ? "added, " + addedHow(A[1], id) : ""]));
      (res.findings || []).forEach(f => findRows.push([res.id, w(f.finding_type), f.phrase || "", f.concept_name || "", w(f.proposed_action), f.proposed_label || "",
        f.facet || "", f.area || "", f.reason || "", f.excerpt || "", rv(0), A[0] ? fdec(A[0], f) : "", rv(1), A[1] ? fdec(A[1], f) : ""]));
    });
    const readme = [["Tagging review: " + S.batch + " (CGIAR Standard for Tagging Climate-Related Work, revision of 24 and 25 November 2026)"], [],
      ["One row per text on the 'reviews' sheet. R1 and R2 are the two reviewers. Use the filters."],
      ["extracted ...", "the answers as recorded by the tagging script (" + ((S.batches.find(b => b.id === S.batch) || {}).prompt || "prompt version in the batch file") + ")"],
      ["verdict", "Rule 8, per area: Not targeted (0), Significant (1), Principal (2) or Cannot be determined, with the rule that decides (N1, P1 to P4, S1, S2)"],
      ["comparison result", "Rule 9: Consistent; The text supports a lower marker; The text supports a higher marker; Marker missing; Not compared. One marker is assigned for both areas: it is compared with the higher of the two verdicts"],
      ["reviewer verdicts and comparison", "worked out from the reviewer's answers (purpose, rule that decides) with the rules of the tagging script. 'incomplete' = a draft with questions not answered"],
      ["review outcome", "wrong when a verdict or the comparison result differs from the extracted one; minor gap when only tags, terms, the pathway, the purpose or the rule differ; captured well when nothing differs"],
      ["reviewers agree", "yes when both reviewers end with the same verdicts and the same comparison result"],
      ["purpose, rule, pathway", "agree, or disagree with the right answer where there is one and the reviewer's note in brackets"],
      ["tags removed / changed", "tags the reviewer removed (with the reason) or corrected (stand-alone, anchored, no anchor, not relevant, unclear; pathway role; intended or realized)"],
      ["terms added", "taxonomy terms the reviewer added, including terms found but not kept, and for which area they count"],
      ["proposals", "terms and synonyms proposed from the text: accepted, rejected or no answer. Detail on the 'findings' sheet"],
      ["tags sheet", "one row per tag and per term added by a reviewer"],
      ["review status", "not reviewed, in progress, 1 review, 2 reviews"],
      ["blind rule", "another reviewer's answers appear only once both reviews of that text are submitted"],
      ["downloaded", new Date().toISOString().slice(0, 16).replace("T", " ") + " by " + S.me]];
''')
sub('''sheet(head, rows, /title|description|reason|terms|tags|measure|purpose|flags|proposed|comment|findings|pathway/)''',
    '''sheet(head, rows, /title|description|reason|terms|tags|rule|purpose|flags|proposed|comment|findings|pathway/)''')
sub('''  return { list, open, compare, agree, exportFile, aiResult, reviewResult, compareWith, norm, sorted, OUTCOMES, areaLevel, areaRank, markerCode };''',
    '''  return { list, open, compare, agree, exportFile, aiResult, reviewResult, compareWith, norm, sorted, verdictOfRule, markerCode };''')
sub('''const SORT_KEY = "v6-list-sort";''', '''const SORT_KEY = "v7-list-sort";''')
sub('''const getSort = () => { if (!S.sortV6) { try { S.sortV6 = localStorage.getItem(SORT_KEY) || "id"; } catch (e) { S.sortV6 = "id"; } } return S.sortV6; };
  const setSort = v => { S.sortV6 = v;''', '''const getSort = () => { if (!S.sortV7) { try { S.sortV7 = localStorage.getItem(SORT_KEY) || "id"; } catch (e) { S.sortV7 = "id"; } } return S.sortV7; };
  const setSort = v => { S.sortV7 = v;''')

# ---- the list of texts: the verdict of each area and the comparison with the assigned marker (list-columns, 26 Nov 2026)
sub('''  function list() {
''', '''  // the list: the verdict of each area (Rule 8) and the comparison with the assigned marker (Rule 9), as extracted,
  // with the colours of the form (verdictCell, cmpCell)
  const listVerdict = (lab, a) => `<div class="lvrow"><span class="small muted">${lab}</span> ${a && a.verdict ? verdictCell(a.verdict, "") : '<span class="small muted">no verdict</span>'}</div>`;
  function list() {
''')
sub('''<th>Title</th><th>Description</th><th>${done ? "Reviewers" : "You"}</th></tr></thead><tbody>''',
    '''<th>Verdict</th><th>Comparison with the assigned marker</th><th>Title</th><th>Description</th><th>${done ? "Reviewers" : "You"}</th></tr></thead><tbody>''')
sub('''<td>${esc(r.title)}</td><td class="small muted">${esc(cut(r.description, 220))}</td>''',
    '''<td class="nowrap">${listVerdict("Adaptation", r.adaptation)}${listVerdict("Mitigation", r.mitigation)}</td><td>${cmpCell(r.comparison_result)}</td>
        <td>${esc(r.title)}</td><td class="small muted">${esc(cut(r.description, 160))}</td>''')

for bad in ("levelWords", "outcomeLabel", "areaLevel", "extMeasure", "measureText", "functionText", "FUNC_OPTS", "L2_additional", "marker_outcome", "climate information", "PRMS marker", "Planned or done"):
    if bad in s:
        k = s.index(bad)
        print("LEFTOVER:", bad, "|", s[max(0, k - 80):k + 60].replace("\n", " "))
io.open("docs/review/v7.js", "w", encoding="utf-8", newline="\n").write(s)
print("docs/review/v7.js written:", s.count("\n") + 1, "lines")
