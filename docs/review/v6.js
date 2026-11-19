// Review form for batches tagged under the CGIAR tagging standard (form "v6" in data/batches.json).
// Loaded before app.js; it uses the helpers of app.js ($, $$, esc, S, api, navBar, search, wireMarks, ...) when it runs.
// The reviewer never chooses a level. The page works the levels and the marker answer out from the answers, with the
// rules and the comparison table of the tagging script (area_level, area_rank and OUTCOMES in
// Taxonomy/3_Tagging/script/PRMS_Tagging.Rmd, copied below). Change both together.
const V6 = (() => {
  const AREAS = ["adaptation", "mitigation"];
  const AX = { adaptation: "Adaptation", mitigation: "Mitigation" };
  const counts = v => v === "stand_alone" || v === "anchored";
  const isCounted = t => counts(t.adaptation) || counts(t.mitigation);
  const W = {
    stand_alone: "stand-alone", anchored: "anchored", no_anchor: "no anchor", not_relevant: "not relevant", refused: "refused",
    rationale: "rationale", system_or_population: "system or population", intervention: "intervention",
    result_output: "result (output)", result_outcome: "result (outcome)", result_impact: "result (impact)",
    result_level_unclear: "result (level not clear)", none: "none",
    planned: "planned", carried_out_or_reported: "carried out or reported", unclear: "unclear", not_applicable: "not applicable",
    main: "main", additional: "additional", not_stated: "not stated",
    text_says_main: "the text says main", text_says_additional: "the text says additional",
    title_names_climate_aim_only: "the title names the climate aim and no other aim",
    other_benefits_are_cobenefits: "other benefits are co-benefits of the climate measure", other: "other",
    stated: "stated", shown_by_measure: "shown by the measure", not_described: "not described", described: "described",
    produced: "produced", carried_out: "carried out", organised: "organised", recommended: "recommended",
    studied_for_response: "studied to serve the climate response",
    rationale_to_intervention: "rationale to intervention", intervention_to_result: "intervention to result",
    clear_from_context: "clear from context",
    unmatched_climate_phrase: "unmatched climate phrase", doubtful_match: "doubtful match",
    possible_misclassification: "possible misclassification", unrecorded_anchor_type: "unrecorded type of climate anchor",
    propose_term: "propose a new term", add_synonym: "add a synonym", change_classification: "change the classification",
    add_anchor_type: "add an anchor type",
  };
  const w = x => x == null || x === "" ? "" : Object.prototype.hasOwnProperty.call(W, x) ? W[x] : String(x).replace(/_/g, " ");
  const cut = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const opt = (v, label, on) => `<option value="${esc(v)}" ${on ? "selected" : ""}>${esc(label)}</option>`;
  const segD = (name, value, label, on, cls, off) => `<label class="seg ${cls || ""} ${off ? "off" : ""}"><input type="radio" name="${esc(name)}" value="${esc(value)}" ${on ? "checked" : ""} ${off ? "disabled" : ""}><span>${label}</span></label>`;

  // ---------------------------------------------------------------- the script's rules (PRMS_Tagging.Rmd, chunk "derive")
  // L0 no climate information | L1 climate context only | L2 a climate measure, purpose additional or not stated |
  // L3 a climate measure and climate is the main purpose
  const areaLevel = a => !a.information ? "L0" : a.measure !== "described" ? "L1" : a.purpose === "main" ? "L3" : "L2";
  // the PRMS marker is compared with the stronger area; at L2, "purpose not stated" is stronger than "purpose additional"
  const areaRank = a => ({ L0: 0, L1: 1, L2: a.purpose === "additional" ? 2 : 3, L3: 4 })[areaLevel(a)];
  // Rows: PRMS marker. Columns: level of the stronger area. Each cell: outcome, reason, and for "cannot determine" the
  // short reason shown with it (marker_outcome_detail, script r12).
  const OUTCOMES = {
    2: {
      L0: ["cannot determine", "The text holds no climate information. It gives no reason to confirm or to doubt the Principal marker.", "no climate information"],
      L1: ["marker higher", "The text gives climate context and describes no climate measure. A Principal marker expects a measure with climate as the main purpose."],
      L2: ["cannot determine", "The text describes a climate measure and does not say whether climate is the main purpose.", "main purpose not stated"],
      L2_additional: ["marker higher", "The text presents climate as an additional purpose. A Principal marker expects climate as the main purpose."],
      L3: ["aligned", "The text describes a climate measure and presents climate as the main purpose."] },
    1: {
      L0: ["cannot determine", "The text holds no climate information. It gives no reason to confirm or to doubt the Significant marker.", "no climate information"],
      L1: ["cannot determine", "The text gives climate context and describes no climate measure. This is too little to judge a Significant marker.", "climate context only"],
      L2: ["aligned", "The text describes a climate measure and does not present climate as the main purpose."],
      L2_additional: ["aligned", "The text describes a climate measure and presents climate as an additional purpose."],
      L3: ["marker lower", "The text presents climate as the main purpose of the work. This fits a Principal marker."] },
    0: {
      L0: ["aligned", "The text holds no climate information. No conflict with the marker is apparent in this text."],
      L1: ["aligned", "The text gives climate context and describes no climate measure. No conflict with the marker is apparent in this text."],
      L2: ["marker lower", "The text describes a climate measure. The marker says the result does not target climate."],
      L2_additional: ["marker lower", "The text describes a climate measure as an additional purpose. The marker says the result does not target climate."],
      L3: ["marker lower", "The text describes a climate measure with climate as the main purpose. The marker says the result does not target climate."] },
  };
  // "(2) Principal" -> 2, "(1) Significant" -> 1, "(0) Not targeted" -> 0, no marker -> null (never converted to 0)
  function markerCode(m) {
    m = String(m || "").trim(); if (!m) return null;
    const d = /\((\d+)\)/.exec(m); if (d) return +d[1];
    const l = m.toLowerCase();
    return l.includes("principal") ? 2 : l.includes("significant") ? 1 : l.includes("not targeted") ? 0 : null;
  }
  // A: {adaptation: {information, measure, purpose}, mitigation: {...}}
  function compareWith(res, A) {
    const ra = areaRank(A.adaptation), rm = areaRank(A.mitigation);
    const area = Math.max(ra, rm) === 0 ? "none" : ra > rm ? "adaptation" : rm > ra ? "mitigation" : "both";
    const strong = rm > ra ? A.mitigation : A.adaptation, lv = areaLevel(strong);
    const col = lv === "L2" && strong.purpose === "additional" ? "L2_additional" : lv;
    const text = String(res.title || "") + String(res.description || "");
    let o;
    if (!text.trim()) o = ["no comparison", "The text is empty.", ""];
    else {
      const c = markerCode(res.marker), cell = c == null ? null : (OUTCOMES[c] || {})[col];
      o = cell ? [cell[0], cell[1], cell[2] || ""] : ["no comparison", "PRMS records no climate marker for this result.", ""];
    }
    return { adaptation: areaLevel(A.adaptation), mitigation: areaLevel(A.mitigation), area, level: lv,
             marker: o[0], reason: o[1], detail: o[2], purpose: { adaptation: A.adaptation.purpose, mitigation: A.mitigation.purpose } };
  }
  const aiAreas = res => Object.fromEntries(AREAS.map(ax => { const a = res[ax] || {}; return [ax, { information: !!a.information, measure: a.measure, purpose: a.purpose }]; }));
  // the AI's answer, as recorded; the short reason with "cannot determine" is worked out when the record predates r12
  function aiResult(res) {
    const c = compareWith(res, aiAreas(res));
    const marker = res.marker_outcome || c.marker;
    const detail = res.marker_outcome_detail != null ? res.marker_outcome_detail : marker === c.marker ? c.detail : "";
    return { adaptation: (res.adaptation || {}).level || c.adaptation, mitigation: (res.mitigation || {}).level || c.mitigation,
             area: res.comparison_area || c.area, level: res.comparison_level || c.level, marker, detail,
             reason: res.marker_outcome_reason || c.reason, purpose: c.purpose };
  }
  const outcomeLabel = (o, d) => d ? `${o}: ${d}` : (o || "");
  const LEVEL_WORDS = { L0: "no climate information", L1: "climate context only", L3: "climate measure, climate the main purpose" };
  const levelWords = (lv, purpose) => lv === "L2" ? (purpose === "additional" ? "climate measure, climate an additional purpose" : "climate measure, main purpose not stated") : LEVEL_WORDS[lv] || "";

  // ---------------------------------------------------------------- the reviewer's answers
  const TAG_FIELDS = ["adaptation", "mitigation", "pathway_role", "status"];
  const FIELD_WORDS = { adaptation: "adaptation", mitigation: "mitigation", pathway_role: "role", status: "planned or done" };
  const AREA_OPTS = role => role === "stand-alone" ? ["stand_alone", "not_relevant"] : role === "context-dependent" ? ["anchored", "no_anchor", "not_relevant"] : ["not_relevant"];
  const ROLE_OPTS = ["rationale", "system_or_population", "intervention", "result_output", "result_outcome", "result_impact", "result_level_unclear", "none"];
  const STATUS_OPTS = ["planned", "carried_out_or_reported", "unclear", "not_applicable"];
  const REFUSE = [["different_meaning", "different meaning in this text"], ["part_of_a_name", "part of a name"], ["too_generic", "too generic"],
                  ["not_this_work", "not about this work"], ["other", "other (say why in the note)"]];
  const NOT_MEASURE = [["study_only", "a study that describes a climate condition and does not serve the response"],
                       ["event_or_topic", "an event attended or a topic discussed"], ["subject_or_setting", "a subject or setting, not an action"],
                       ["general_statement", "a general statement or aim"], ["not_climate_response", "the action does not respond to a climate problem"],
                       ["other", "other (say why in the comment)"]];
  const PURPOSE_TESTS = {
    main: [["text_says_main", W.text_says_main], ["title_names_climate_aim_only", W.title_names_climate_aim_only],
           ["other_benefits_are_cobenefits", W.other_benefits_are_cobenefits], ["other", "other (say why in the comment)"]],
    additional: [["text_says_additional", W.text_says_additional], ["other", "other (say why in the comment)"]] };
  const label = (list, v) => (list.find(x => x[0] === v) || [v, w(v)])[1];
  const DROP_WORDS = { "not_kept:other": "not kept by the AI", "not_kept:part_of_a_name": "part of a name", "not_kept:different_meaning": "different meaning in this text",
    "not_kept:too_generic": "too generic", broader_term_of_a_kept_tag: "broader term of a kept tag", excerpt_not_in_text: "wording not found in the text",
    "second_check:not_present": "second check: not in the text", anchor_without_climate_information: "anchor without climate wording" };
  const dropWord = r => DROP_WORDS[r] || String(r || "").replace(/^second_check:/, "second check: ").replace(/^not_kept:/, "").replace(/_/g, " ");
  const fkey = f => [f.finding_type || "", f.concept_id || "", f.phrase || ""].join("|");

  function norm(a, res) {
    a = a && typeof a === "object" ? JSON.parse(JSON.stringify(a)) : {};
    a.areas = a.areas || {};
    AREAS.forEach(ax => { a.areas[ax] = Object.assign({ measure: null, measure_reason: "", measure_quote: "", purpose: null, purpose_basis: "" }, a.areas[ax] || {}); });
    // The answers start as the AI's (decision of 19 Nov 2026); the reviewer changes only what is wrong.
    AREAS.forEach(ax => {
      const r = a.areas[ax], ai = res[ax] || {};
      if (r.measure == null) r.measure = "agree";
      if (r.purpose == null) {
        r.purpose = ai.purpose || "not_stated";
        r.purpose_basis = r.purpose !== "not_stated" && ai.purpose_basis && ai.purpose_basis !== "none" ? ai.purpose_basis : "";
      }
    });
    a.tags = a.tags || {}; a.added_terms = a.added_terms || []; a.added_counts = a.added_counts || {}; a.findings = a.findings || {};
    a.pathway_note = a.pathway_note || ""; a.proposals = a.proposals || []; a.comment = a.comment || "";
    (res.tags || []).forEach(t => { if (!a.tags[t.concept_id]) a.tags[t.concept_id] = { d: "agree" }; });
    a.result_id = res.id;
    delete a.computed; delete a.basis;          // worked out again at each save
    return a;
  }
  const dec = (R, t) => (R.tags || {})[t.concept_id] || { d: "agree" };
  const val = (R, t, f) => { const d = dec(R, t); return d.d === "change" && d[f] != null ? d[f] : t[f]; };
  const tagChanged = (t, d) => !!d && (d.d === "refuse" || (d.d === "change" && TAG_FIELDS.some(f => d[f] != null && d[f] !== t[f])));
  const countsFor = (res, R, ax) => [
    ...(res.tags || []).filter(t => dec(R, t).d !== "refuse" && counts(val(R, t, ax))).map(t => ({ id: t.concept_id, name: t.concept_name, how: val(R, t, ax) })),
    ...(R.added_terms || []).filter(id => ((R.added_counts || {})[id] || {})[ax]).map(id => ({ id, name: (S.terms[id] || {}).term || id, how: "added" }))];
  const infoOf = (res, R, ax) => countsFor(res, R, ax).length > 0;

  function reviewAreas(res, R) {
    const A = {}, missing = [];
    AREAS.forEach(ax => {
      const ai = res[ax] || {}, r = R.areas[ax], info = infoOf(res, R, ax);
      let measure = "not_described", purpose = "not_stated";
      if (info) {
        if (!r.measure) missing.push(`${AX[ax]}: answer the question on the climate measure.`);
        else if (r.measure === "not_measure" && !r.measure_reason) missing.push(`${AX[ax]}: say why it is not a climate measure.`);
        else if (r.measure === "missed" && !String(r.measure_quote || "").trim()) missing.push(`${AX[ax]}: paste the passage that describes the measure the AI missed.`);
        if ((r.measure === "agree" && ai.measure === "described") || r.measure === "missed") measure = "described";
        if (measure === "described") {
          if (!r.purpose) missing.push(`${AX[ax]}: answer the question on the purpose.`);
          purpose = r.purpose || "not_stated";
        }
      }
      A[ax] = { information: info, measure, purpose };
    });
    (res.tags || []).forEach(t => { const d = dec(R, t); if (d.d === "refuse" && !d.reason) missing.push(`Give a reason for refusing the tag ${t.concept_name}.`); });
    return { A, missing };
  }
  // captured well / minor gap / wrong: wrong when a level or the marker answer differs from the AI's; minor gap when only
  // tags, terms, the pathway or the purpose differ; the taxonomy findings and proposals do not count
  function reviewResult(res, R) {
    const { A, missing } = reviewAreas(res, R), c = compareWith(res, A), ai = aiResult(res);
    let review = "";
    if (!missing.length) {
      if (c.adaptation !== ai.adaptation || c.mitigation !== ai.mitigation || c.marker !== ai.marker) review = "wrong";
      else {
        const purposeDiff = AREAS.some(ax => A[ax].measure === "described" && (res[ax] || {}).measure === "described" && A[ax].purpose !== ((res[ax] || {}).purpose || "not_stated"));
        const minor = (res.tags || []).some(t => tagChanged(t, (R.tags || {})[t.concept_id])) || (R.added_terms || []).length > 0
          || !!String(R.pathway_note || "").trim() || purposeDiff;
        review = minor ? "minor gap" : "captured well";
      }
    }
    return { ...c, A, missing, complete: !missing.length, review };
  }
  function agree(id) {
    const v = S.others[id] || [], res = S.byId[id]; if (v.length < 2 || !res) return null;
    const [x, y] = v.slice(0, 2).map(r => reviewResult(res, norm(r.answers, res)));
    return x.adaptation === y.adaptation && x.mitigation === y.mitigation && x.marker === y.marker;
  }

  // ---------------------------------------------------------------- "?" toggles: a short explanation and a link to rules.html
  const HELP = {
    marker: ["PRMS climate marker", "The climate marker recorded in PRMS for this result: Principal (2), Significant (1) or Not targeted (0). It is one marker for adaptation and mitigation together. The review does not change it; the text is compared with it."],
    levels: ["level", "The AI's level for this area. You do not choose a level: it follows from your answers on the tags, the climate measure and the purpose. It is a step in the comparison with the PRMS marker, not a score of the work.",
      `<table class="hlp-t"><tr><th>Level</th><th>The text</th></tr>
        <tr><td>L0</td><td>holds no climate information for this area: no tag counts.</td></tr>
        <tr><td>L1</td><td>mentions climate (a hazard, climate change, emissions) but describes no climate measure.</td></tr>
        <tr><td>L2</td><td>describes a climate measure; climate is an additional purpose, or the purpose is not stated.</td></tr>
        <tr><td>L3</td><td>describes a climate measure, and climate is the main purpose.</td></tr></table>`],
    "climate-information": ["climate information", "The taxonomy terms that count for this area: stand-alone terms, and context-dependent terms with a climate anchor in the text. If no term counts, the area holds no climate information. Change them in the tag table."],
    measure: ["climate measure", "An action the work carried out, produced, organised or recommends, in response to a climate problem of this area. A study that only describes a climate condition, an event attended or a general aim is not a measure. Keep the AI's answer, say why it is not a measure, or paste the passage of a measure the AI missed."],
    purpose: ["purpose", "Whether the text presents climate as the main purpose of the work, an additional purpose, or does not say. The purpose counts only when a climate measure is described."],
    tags: ["AI tags", "Each taxonomy term the AI kept, with the words it was found as, its value for each area, its role in the text and whether the work is planned or done. Click ✓ to agree, change to correct a value, or ✗ to refuse the tag with a reason."],
    anchors: ["tag values", "Stand-alone: the term is climate information on its own. Anchored: a context-dependent term with a climate anchor in the text, shown in quotes. No anchor: a context-dependent term without a climate anchor, so it does not count. Not relevant: the term does not concern this area."],
    "terms-not-kept": ["words found but not tagged", "Before the AI reads the text, a search marks every word that matches a taxonomy term or synonym. The AI then keeps some as tags and leaves others out; the code can also refuse one. These are the ones left out, with where they are in the text and why. If one should be a tag, click + keep."],
    findings: ["AI taxonomy findings", "Possible gaps or errors in the taxonomy that the AI recorded, such as a climate phrase with no matching term. Accept, reject or leave each one for later. These answers go to the taxonomy team and do not change the outcome of your review."],
    pathway: ["climate pathway", "The parts of the climate pathway the AI recorded for each area: reason, where, who, what was done, what came out, the links between them, and whether the work is planned or done. Open it when useful and note any part to correct."],
    flags: ["flags", "Points the tagging script asks a person to look at first, for example an area that rests on anchors only or an answer changed by the second check. A flag is not an error."],
    "marker-answer": ["marker answer", "The comparison of the PRMS marker with the stronger area: aligned, marker higher, marker lower, cannot determine (with its reason) or no comparison. It is worked out from the levels with the table of the tagging script."],
    outcome: ["outcome of the review", "Worked out from your answers. Wrong when a level or the marker answer differs from the AI's; minor gap when only tags, terms, the pathway or the purpose differ; captured well when nothing differs."],
    proposals: ["proposed terms", "Wording that is not in the taxonomy, proposed as a new term or as a synonym of an existing term. Proposals go to the people who maintain the taxonomy."],
  };
  // "?" boxes open on hover where the screen has a mouse; a click keeps one open; on touch screens a tap opens it.
  if (typeof window !== "undefined" && typeof document !== "undefined" && !window.__hlpHover) {
    window.__hlpHover = true;
    const canHover = !!(window.matchMedia && window.matchMedia("(hover: hover)").matches);
    const place = d => { const b = d.querySelector(".hlp-b"); if (!b) return; b.style.left = ""; b.style.right = "";
      const r = b.getBoundingClientRect(); if (r.right > window.innerWidth - 8) { b.style.left = "auto"; b.style.right = "0"; } };
    const hlpOf = el => (el && el.closest) ? el.closest("details.hlp") : null;
    document.addEventListener("mouseover", e => { if (!canHover) return; const d = hlpOf(e.target);
      if (d && !d.open) { d.dataset.hover = "1"; d.open = true; place(d); } });
    document.addEventListener("mouseout", e => { if (!canHover) return; const d = hlpOf(e.target);
      if (d && d.dataset.hover === "1" && !d.contains(e.relatedTarget)) { delete d.dataset.hover; d.open = false; } });
    document.addEventListener("click", e => { const s = e.target.closest && e.target.closest("details.hlp > summary");
      if (s && s.parentElement.dataset.hover === "1") { e.preventDefault(); delete s.parentElement.dataset.hover; } }, true);
    document.addEventListener("toggle", e => { if (e.target.matches && e.target.matches("details.hlp") && e.target.open) place(e.target); }, true);
  }
  const help = key => { const h = HELP[key] || [key, ""];
    // h[2]: an optional table, fixed text written in this file (not data), shown under the explanation
    return `<details class="hlp"><summary aria-label="Explain: ${esc(h[0])}" title="What is this?">?</summary><span class="hlp-b">${esc(h[1])}${h[2] || ""} <a href="rules.html#${esc(key)}" target="_blank" rel="noopener">More information</a></span></details>`; };

  // ---------------------------------------------------------------- small pieces of display
  const lvPill =(lv, purpose) => lv ? `<span class="lv lv-${esc(lv)}" title="${esc(levelWords(lv, purpose))}">${esc(lv)}</span>` : "";
  const levelCell = (lv, purpose) => `${lvPill(lv, purpose)} <span class="small">${esc(levelWords(lv, purpose))}</span>`;
  const markerCell = (o, d) => o ? `<span class="oc oc-${esc(o.replace(/ /g, "-"))}">${esc(outcomeLabel(o, d))}</span>` : "";
  const storeNotice = () => S.storeOk === false ? `<div class="notice bad">The review store does not take reviews of this batch yet (the worker is older than the page). You can read the results; nothing can be saved until the worker is updated.</div>` : "";
  function foundAs(t) {
    const ex = t.detection_excerpt || "", hl = t.hl || "", i = hl ? ex.toLowerCase().indexOf(hl.toLowerCase()) : -1;
    return i < 0 ? esc(ex) : esc(ex.slice(0, i)) + `<b>${esc(ex.slice(i, i + hl.length))}</b>` + esc(ex.slice(i + hl.length));
  }

  // Highlighting: only the taxonomy term or synonym found inside each tag's excerpt (t.hl, written by build_data.py with
  // the rule of term_in() in gen_diag.py), at the place of the excerpt in the text. When the excerpt is not found word for
  // word in the text, every occurrence of the term; when no term or synonym was found in the excerpt, the excerpt itself
  // (up to 160 characters), as gen_diag.py does. Terms added by the reviewer: every occurrence of the term and synonyms.
  function hlHtml(text, res, added) {
    text = text || ""; const low = text.toLowerCase(), hits = [];
    const free = (b, e) => !hits.some(h => b < h.e && e > h.b);
    const edge = (b, e) => !/[a-z0-9]/.test(b === 0 ? " " : low[b - 1]) && !/[a-z0-9]/.test(low[e] || " ");
    const every = (q, cls, id) => { q = (q || "").trim().toLowerCase(); if (q.length < 3 || q.length > 160) return;
      for (let i = low.indexOf(q); i >= 0; i = low.indexOf(q, i + 1)) if (edge(i, i + q.length) && free(i, i + q.length)) hits.push({ b: i, e: i + q.length, cls, id }); };
    (res.tags || []).slice().sort((a, b) => (b.hl || "").length - (a.hl || "").length).forEach(t => {
      const cls = isCounted(t) ? "hc" : "hg", ex = (t.detection_excerpt || "").trim().toLowerCase(), word = (t.hl || "").toLowerCase();
      if (!word) return every(ex, cls, t.concept_id);
      const off = ex ? ex.indexOf(word) : -1; let found = false;
      if (off >= 0) for (let i = low.indexOf(ex); i >= 0; i = low.indexOf(ex, i + 1)) {
        if (!edge(i, i + ex.length)) continue;
        found = true; const b = i + off, e = b + word.length; if (free(b, e)) hits.push({ b, e, cls, id: t.concept_id }); }
      if (!found) every(word, cls, t.concept_id);
    });
    const forms = [];
    (added || []).forEach(id => { const t = S.terms[id]; if (t) [t.term, ...(t.synonyms || [])].forEach(x => forms.push([x, id])); });
    forms.sort((a, b) => b[0].length - a[0].length).forEach(([x, id]) => every(x, "ha", id));
    hits.sort((a, b) => a.b - b.b);
    let html = "", at = 0;
    hits.forEach(h => { html += esc(text.slice(at, h.b)) + `<mark class="${h.cls}" data-id="${esc(h.id)}" title="${esc((S.terms[h.id] || {}).term || h.id)}">${esc(text.slice(h.b, h.e))}</mark>`; at = h.e; });
    return html + esc(text.slice(at));
  }
  function textBlock(res, added, editable) {
    const tr = res.translated && (res.title_en || res.description_en);
    const title = tr ? res.title_en || res.title : res.title, desc = tr ? res.description_en || res.description : res.description;
    return `<div class="text card" ${editable ? "data-edit" : ""}><div class="legend"><span class="k hc">counts</span><span class="k hg">found, does not count</span><span class="k ha">${editable ? "added by you" : "added by a reviewer"}</span></div>
      ${editable ? `<div class="hint small">Select a word or phrase in the text to tag it.</div>` : ""}
      ${tr ? `<div class="hint small">Translated into English for the tagging. The original text is at the end.</div>` : ""}
      <h2>${hlHtml(title, res, added)}</h2><p>${hlHtml(desc, res, added)}</p>
      ${tr ? `<details class="orig"><summary class="small">Original text</summary><h4>${esc(res.title)}</h4><p>${esc(res.description)}</p></details>` : ""}</div>`;
  }

  // ---------------------------------------------------------------- list
  function list() {
    const rows = S.list.filter(r => bucket(r) === S.tab);
    const done = S.tab === "agree" || S.tab === "disagree";
    const who = id => (S.others[id] || []).map(v => esc(v.reviewer)).join(", ");
    const you = r => { const m = S.mine[r.id]; return m ? (m.submitted ? "submitted" : "draft") : ""; };
    $("#main").innerHTML = storeNotice() + (rows.length ? `<p class="hint">Each row is one PRMS result, with the AI's level for each area and its marker answer. Click a row to open it${done ? " and see both reviews" : " and review it"}.</p><div class="card flush"><table class="list">
      <thead><tr><th>ID</th><th>Marker</th><th>Adaptation</th><th>Mitigation</th><th>Marker answer</th><th>Title</th><th>${done ? "Reviewers" : "You"}</th></tr></thead><tbody>
      ${rows.map(r => { const ai = aiResult(r); return `<tr data-id="${esc(r.id)}"><td class="mono">${esc(r.id)}</td><td class="nowrap">${esc(r.marker)}</td>
        <td>${lvPill(ai.adaptation, ai.purpose.adaptation)}</td><td>${lvPill(ai.mitigation, ai.purpose.mitigation)}</td><td class="small">${markerCell(ai.marker, ai.detail)}</td>
        <td>${esc(r.title)}</td><td class="muted small nowrap">${done ? who(r.id) : you(r)}</td></tr>`; }).join("")}</tbody></table></div>`
      : `<div class="empty">Nothing here.</div>`);
    $$("tr[data-id]").forEach(tr => tr.onclick = () => location.hash = "#/r/" + encodeURIComponent(tr.dataset.id));
  }

  // ---------------------------------------------------------------- one result: the form
  function open(res) {
    const m = S.mine[res.id];
    S.rev = norm(m && m.answers, res);
    view();
  }

  function view() {
    const res = S.cur, R = S.rev, submitted = S.mine[res.id] && S.mine[res.id].submitted;
    $("#main").innerHTML = navBar(res) + storeNotice() + (submitted ? `<div class="notice">Submitted. You can still change it until the second reviewer submits.</div>` : "")
    + `<div class="cols">${textBlock(res, R.added_terms, true)}<div class="side v6">
      <section class="card intro" id="v6-intro"><p><b>Check each answer below.</b> The answers start as the AI's: change only what is wrong, then submit.
        <a href="rules.html#what-to-do" target="_blank" rel="noopener">How to review</a></p>
        <div class="flags small" id="v6-flags"><b>Flags</b> ${help("flags")} ${(res.review_flags || []).length ? res.review_flags.map(f => `<span class="flag">${esc(f)}</span>`).join("") : `<span class="muted">none</span>`}</div></section>
      ${AREAS.map(ax => `<section class="card area" id="v6-area-${ax}"></section>`).join("")}
      <section class="card" id="v6-path">${pathwayHtml(res)}</section>
      <section class="card flush" id="v6-tags"></section>
      <section class="card" id="v6-dropped"></section>
      <section class="card" id="v6-add"><h3>Add a term</h3>
        <input id="q" class="search" placeholder="Search terms and synonyms" autocomplete="off">
        <div id="hits" class="hits"></div>
        <div id="added" class="chips"></div>
        <a href="#" id="brw" class="small">Browse the taxonomy</a>
        <div id="tree" class="tree" hidden></div></section>
      <section class="card" id="v6-findings"></section>
      <section class="card" id="v6-props"><h3>Proposed new terms and synonyms ${help("proposals")}</h3><div id="props" class="chips"></div></section>
      <section class="card" id="v6-comment"><h3>Comment</h3><textarea id="cm" placeholder="Anything the others should know">${esc(R.comment || "")}</textarea></section>
      <details class="card gives" id="v6-gives"><summary>What your answers give</summary><div id="v6-gives-b"></div></details>
      <div class="actions"><span id="msg" class="small"></span><button id="save">Save draft</button><button class="primary" id="sub">Submit</button></div>
    </div></div>`;
    const mk = $(".nav .meta span");                   // the PRMS marker in the header line, with its "?"
    if (mk) mk.insertAdjacentHTML("beforeend", " " + help("marker"));
    renderGives(); AREAS.forEach(renderArea); renderTags(); renderDropped(); renderFindings();
    wire();
  }

  // folded near Submit: the levels, marker answer and outcome that follow from the answers (computed, not answered)
  function renderGives() {
    const res = S.cur, R = S.rev, ai = aiResult(res), me = reviewResult(res, R), box = $("#v6-gives-b");
    if (!box) return;
    const d = (a, b) => me.complete && a !== b ? "diff" : "";
    const pend = `<span class="muted small">answer the open questions</span>`;
    box.innerHTML = `<p class="small muted">Worked out from your answers with the table of the tagging script. You do not set these.</p>
      <table class="lvl"><thead><tr><th></th><th>AI</th><th>Your answers</th></tr></thead><tbody>
      ${AREAS.map(ax => `<tr><th>${AX[ax]} ${ax === "adaptation" ? help("levels") : ""}</th><td>${levelCell(ai[ax], ai.purpose[ax])}</td><td class="${d(ai[ax], me[ax])}">${me.complete ? levelCell(me[ax], me.purpose[ax]) : pend}</td></tr>`).join("")}
      <tr><th>Marker answer ${help("marker-answer")}</th><td>${markerCell(ai.marker, ai.detail)}</td><td class="${d(ai.marker, me.marker)}">${me.complete ? markerCell(me.marker, me.detail) : pend}</td></tr>
      </tbody></table>
      ${me.complete ? `<p class="small">${esc(me.reason)}</p><div class="outcome">Outcome of your review: <span class="rv rv-${esc(me.review.replace(/ /g, "-"))}">${esc(me.review)}</span> ${help("outcome")}</div>`
        : `<ul class="missing small">${me.missing.slice(0, 4).map(x => `<li>${esc(x)}</li>`).join("")}${me.missing.length > 4 ? `<li>and ${me.missing.length - 4} more</li>` : ""}</ul>`}`;
  }

  function renderArea(ax) {
    const res = S.cur, R = S.rev, ai = res[ax] || {}, r = R.areas[ax], me = reviewResult(res, R);
    const aiTerms = (res.tags || []).filter(t => counts(t[ax])).map(t => ({ id: t.concept_id, name: t.concept_name, how: t[ax] }));
    const myTerms = countsFor(res, R, ax), info = myTerms.length > 0, live = info || !!ai.information;
    const termList = l => l.length ? l.map(x => `${esc(x.name)} <span class="muted">(${esc(w(x.how))})</span>`).join(", ") : `<span class="muted">none</span>`;
    const same = aiTerms.length === myTerms.length && aiTerms.every((x, i) => x.id === myTerms[i].id && x.how === myTerms[i].how);
    const aiLv = ai.level || "L0";
    let h = `<div class="ah"><span class="ax">${AX[ax]}</span><span class="small muted">AI</span> ${levelCell(aiLv, ai.purpose)} ${help("levels")}</div>
      <div class="q1"><div class="qh">Climate information ${help("climate-information")} <span class="muted small">terms that count for ${ax}</span></div>
        <div class="small">${termList(aiTerms)}</div>
        ${same ? "" : `<div class="small you">With your changes: ${termList(myTerms)}</div>`}
        <div class="muted small">Change them in the tag table below.</div></div>`;
    if (!live) {
      h += `<p class="muted small">No term counts for ${ax}, so there is no measure or purpose to judge: level L0.</p>`;
    } else {
      const off = !info, aiDesc = ai.measure === "described";
      const opts = aiDesc ? [["agree", "Agree", "ok"], ["not_measure", "Not a measure", "ko"]] : [["agree", "Agree: no measure", "ok"], ["missed", "Measure missed", "ko"]];
      h += `<div class="q1 ${off ? "off" : ""}"><div class="qh">Climate measure ${help("measure")}</div>
        <div class="small"><span class="muted">AI:</span> ${aiDesc ? `“${esc(ai.measure_quote || "")}”${ai.measure_kind ? ` <span class="muted">(${esc(w(ai.measure_kind))})</span>` : ""}` : `<span class="muted">no climate measure described</span>`}</div>
        ${ai.objective && ai.objective !== "not_described" ? `<div class="small muted">Objective: ${esc(w(ai.objective))}${ai.objective_quote ? `, “${esc(ai.objective_quote)}”` : ""}</div>` : ""}
        <div class="decide"><span class="segs">${opts.map(([v, l, c]) => segD("m-" + ax, v, l, r.measure === v, c, off)).join("")}</span>
          ${r.measure === "not_measure" ? `<select data-k="measure_reason" data-ax="${ax}" ${off ? "disabled" : ""}><option value="">why not…</option>${NOT_MEASURE.map(([v, l]) => opt(v, l, r.measure_reason === v)).join("")}</select>` : ""}</div>
        ${r.measure === "missed" ? `<input class="wide" data-k="measure_quote" data-ax="${ax}" placeholder="paste the passage that describes the measure" value="${esc(r.measure_quote || "")}" ${off ? "disabled" : ""}>` : ""}</div>`;
      const needP = me.A[ax].measure === "described", aiP = ai.purpose || "not_stated", offP = off || !needP;
      // only main / additional / not stated is shown and asked (Lolita, 19 Nov 2026): no test names, no test to choose
      h += `<div class="q1 ${offP ? "off" : ""}"><div class="qh">Purpose ${help("purpose")} <span class="muted small">main, additional or not stated</span></div>
        <div class="small"><span class="muted">AI:</span> ${esc(w(aiP))}</div>
        <div class="decide"><span class="segs">${["main", "additional", "not_stated"].map(v => segD("p-" + ax, v, w(v) + (v === aiP ? ` <small>AI</small>` : ""), r.purpose === v, "ok", offP)).join("")}</span></div>
        ${offP && !off ? `<div class="muted small">${r.measure ? "The purpose counts only when a climate measure is described." : "Answer the question on the climate measure first."}</div>` : ""}</div>`;
      if (off) h += `<p class="muted small">After your changes no term counts for ${ax}: level L0.</p>`;
    }
    $("#v6-area-" + ax).innerHTML = h;
  }

  function pathwayHtml(res) {
    const A = res.adaptation || {}, M = res.mitigation || {};
    const L = x => (x || []).length ? (x || []).map(esc).join("; ") : `<span class="muted">not described</span>`;
    const links = ax => (res.links || []).filter(l => l.area === ax).map(l => `<div>${esc(l.from_name)} → ${esc(l.to_name)} <span class="muted">(${esc(w(l.kind))}, ${esc(w(l.how))})</span>${l.quote ? `<div class="q">“${esc(cut(l.quote, 200))}”</div>` : ""}</div>`).join("") || `<span class="muted">none</span>`;
    const geo = res.geography ? `${esc(res.geography)} <span class="muted">(${esc(res.geography_source || "")})</span>` : `<span class="muted">not described</span>`;
    const cit = res.countries_in_text && res.countries_in_text !== res.geography ? `<div class="small muted">Countries named in the text: ${esc(res.countries_in_text)}</div>` : "";
    const type = a => (a.intervention_type || []).length ? `<div class="small muted">Type: ${(a.intervention_type || []).map(esc).join("; ")}</div>` : "";
    const st = x => x ? esc(x) : `<span class="muted">not described</span>`;
    return `<h3>Climate pathway ${help("pathway")}</h3>
      <details id="v6-pathway"><summary class="small">Show the pathway: reason, where, who, what was done, what came out, links, planned or done</summary>
      <table class="pway small"><thead><tr><th></th><th>Adaptation</th><th>Mitigation</th></tr></thead><tbody>
      <tr><th>Reason</th><td>${L(A.rationale)}</td><td>${L(M.rationale)}</td></tr>
      <tr><th>Where</th><td colspan="2">${geo}${cit}</td></tr>
      <tr><th>Who</th><td>${L(A.system_or_population)}</td><td>${L(M.system_or_population)}</td></tr>
      <tr><th>What was done</th><td>${L(A.intervention)}${type(A)}</td><td>${L(M.intervention)}${type(M)}</td></tr>
      <tr><th>What came out</th><td>${L(A.result)}</td><td>${L(M.result)}</td></tr>
      <tr><th>Links</th><td>${links("adaptation")}</td><td>${links("mitigation")}</td></tr>
      <tr><th>Planned or done</th><td colspan="2">What was done: ${st(res.intervention_status)}. What came out: ${st(res.result_status)}.</td></tr>
      </tbody></table>
      <label class="small pnote">Pathway parts to correct (optional)<input class="wide" data-k="pathway_note" placeholder="for example: the result is an aim, not a reported result" value="${esc(S.rev.pathway_note || "")}"></label>
    </details>`;
  }

  function areaCell(t, ax, d) {
    const v = t[ax], role = t["role_" + ax], mine = d.d === "change" && d[ax] != null && d[ax] !== v ? d[ax] : null, q = t[ax + "_anchor_quote"];
    return `<span class="cv cv-${esc(v)}">${esc(w(v))}</span>${mine ? ` → <span class="you">${esc(w(mine))}</span>` : ""}
      ${role && role !== "n/a" && role !== w(v) ? `<div class="muted">${esc(role)}</div>` : ""}
      ${v === "anchored" && q ? `<div class="q" title="${esc(q)}">“${esc(cut(q, 110))}”</div>` : ""}`;
  }
  function tagRow(t, d, extra = "") {
    const id = t.concept_id, cls = [d.d === "refuse" ? "disagree" : "", d.d === "change" ? "changed" : ""].join(" ");
    const shown = (f, v) => { const mine = d.d === "change" && d[f] != null && d[f] !== v ? d[f] : null; return esc(w(v)) + (mine ? ` → <span class="you">${esc(w(mine))}</span>` : ""); };
    const sel = (f, opts) => `<select data-k="tag-${f}" data-id="${esc(id)}">${[...new Set([t[f], ...opts])].filter(x => x != null && x !== "").map(o => opt(o, w(o), (d[f] != null ? d[f] : t[f]) === o)).join("")}</select>`;
    const sub = d.d === "change" ? `<tr class="sub"><td colspan="7"><div class="subf">
        <label>Adaptation ${sel("adaptation", AREA_OPTS(t.role_adaptation))}</label><label>Mitigation ${sel("mitigation", AREA_OPTS(t.role_mitigation))}</label>
        <label>Role in the text ${sel("pathway_role", ROLE_OPTS)}</label><label>Planned or done ${sel("status", STATUS_OPTS)}</label>
        <input data-k="tag-note" data-id="${esc(id)}" placeholder="anchor passage or note (optional)" value="${esc(d.note || "")}"></div></td></tr>`
      : d.d === "refuse" ? `<tr class="sub"><td colspan="7"><div class="subf"><label>Reason <select data-k="tag-reason" data-id="${esc(id)}"><option value="">choose…</option>${REFUSE.map(([v, l]) => opt(v, l, d.reason === v)).join("")}</select></label>
        <input data-k="tag-note" data-id="${esc(id)}" placeholder="note (optional)" value="${esc(d.note || "")}"></div></td></tr>` : "";
    return `<tr id="t-${esc(id)}" class="${cls}"><td><a href="#" class="jump" data-id="${esc(id)}">${esc(t.concept_name)}</a><div class="mono muted">${esc(id)} · ${esc(t.facet)}</div></td>
      <td class="small">${foundAs(t)}</td><td class="small">${areaCell(t, "adaptation", d)}</td><td class="small">${areaCell(t, "mitigation", d)}</td>
      <td class="small">${shown("pathway_role", t.pathway_role)}</td>
      <td class="small">${t.status === "not_applicable" && !(d.d === "change" && d.status && d.status !== t.status) ? `<span class="muted">not applicable</span>` : shown("status", t.status)}${t.status_quote ? `<div class="q" title="${esc(t.status_quote)}">“${esc(cut(t.status_quote, 80))}”</div>` : ""}</td>
      <td class="nowrap"><span class="segs sm">${segD("d-" + id, "agree", "✓", d.d === "agree", "ok")}${segD("d-" + id, "change", "change", d.d === "change", "ch")}${segD("d-" + id, "refuse", "✗", d.d === "refuse", "ko")}</span></td></tr>${extra}${sub}`;
  }
  // why a tag does not count, in plain words, from its values (the reviewer's when changed)
  const whyNot = (t, ax, v) => v === "no_anchor" ? "no anchor (no link to climate in the text)"
    : v === "not_relevant" ? (!t["role_" + ax] || t["role_" + ax] === "n/a" ? `not relevant (the taxonomy gives this term no ${ax} role)` : `not relevant (the text does not use it for ${ax})`)
    : w(v);
  // two groups: tags that count (an area is stand-alone or anchored) and tags that do not; a tag moves when a value changes
  function renderTags() {
    const res = S.cur, R = S.rev, all = res.tags || [];
    const counting = t => counts(val(R, t, "adaptation")) || counts(val(R, t, "mitigation"));
    const yes = all.filter(counting), no = all.filter(t => !counting(t));
    const head = `<thead><tr><th>Term</th><th>Found as</th><th>Adaptation</th><th>Mitigation</th><th>Role in the text</th><th>Planned or done</th><th></th></tr></thead>`;
    const why = t => `<tr class="why"><td colspan="7">Why it does not count: ${AREAS.map(ax => `${ax}: ${esc(whyNot(t, ax, val(R, t, ax)))}`).join("; ")}</td></tr>`;
    $("#v6-tags").innerHTML = `<h3 class="pad">AI tags <span class="muted">${all.length}</span></h3>
      <div class="hint small pad">A tag counts only when an area says stand-alone or anchored ${help("anchors")}. No anchor or not relevant: the term is tagged but is not climate information. ${help("tags")}</div>
      <h4 class="pad grp">Tags that count as climate information <span class="muted">${yes.length}</span></h4>
      <table class="tags v6t">${head}<tbody>${yes.map(t => tagRow(t, dec(R, t))).join("") || `<tr><td colspan="7" class="muted">None.</td></tr>`}</tbody></table>
      <h4 class="pad grp">Tags that do not count <span class="muted">${no.length}</span></h4>
      <table class="tags v6t nocount">${head}<tbody>${no.map(t => tagRow(t, dec(R, t), why(t))).join("") || `<tr><td colspan="7" class="muted">None.</td></tr>`}</tbody></table>
      <div class="hint small pad">✓ agree, change to correct a value, ✗ to refuse a tag (a reason is needed).</div>`;
  }

  // why a word found by the term search is not a tag, as a full sentence (reason codes of prms_drops.jsonl)
  function whyNotTagged(z) {
    const d = String(z.detail || ""), q = d ? `“${esc(cut(d, 120))}”` : "";
    switch (z.reason) {
      case "not_kept:other": return "The AI read the text and decided this term does not apply here.";
      case "not_kept:different_meaning": return "The AI decided the word has another meaning in this text than the taxonomy term.";
      case "not_kept:part_of_a_name": return "The words are part of a name (a programme, project, organisation, event or publication), so they are not climate information about the work.";
      case "not_kept:too_generic": return "The AI found the word too general to say anything about this work.";
      case "broader_term_of_a_kept_tag": return `A narrower term on the same words is already tagged${d ? `: ${esc(d)}` : ""}. Only the narrower term is kept.`;
      case "excerpt_not_in_text": return `The AI wanted to tag this term with the words ${q}, but these words are not in the text word for word. Every quote must be in the text, so the code refused the tag.`;
      case "second_check:not_present": return `A second AI check said the term is not in the text${d ? `: ${esc(cut(d, 140))}` : "."}`;
      case "area_not_addressed_by_the_text": return `The term belongs to ${esc(d || "an area")} in the taxonomy, and the text does not talk about that area.`;
      case "anchor_without_climate_information": return "The AI linked it to a passage that holds no climate words, so the code did not keep it.";
      default: return esc(dropWord(z.reason)) + (d ? `: ${esc(cut(d, 140))}` : "");
    }
  }
  function renderDropped() {
    const res = S.cur, R = S.rev, l = res.dropped || [];
    const ctx = x => { if (!x.context) return `<span class="muted">not found in the text as a taxonomy term</span>`;
      const c = x.context, w = x.found_as || "", i = w ? c.toLowerCase().indexOf(w.toLowerCase()) : -1;
      return i < 0 ? esc(c) : esc(c.slice(0, i)) + `<b class="hl-g">${esc(c.slice(i, i + w.length))}</b>` + esc(c.slice(i + w.length)); };
    $("#v6-dropped").innerHTML = `<h3>Words found in the text but not tagged <span class="muted">${l.length}</span> ${help("terms-not-kept")}</h3>
      <p class="hint small">Before the AI reads the text, a search marks every word that matches a taxonomy term or synonym. These words were marked, then left out. Each row says where the words are and why they are not a tag. If one should be a tag, click + keep.</p>` + (l.length
      ? `<table class="tags drops"><thead><tr><th>Term</th><th>Where in the text</th><th>Why it is not a tag</th><th></th></tr></thead><tbody>${l.map(x => { const kept = R.added_terms.includes(x.concept_id);
          return `<tr><td><b>${esc(x.concept_name)}</b><div class="mono muted">${esc(x.concept_id)}${(S.terms[x.concept_id] || {}).facet ? " · " + esc(S.terms[x.concept_id].facet) : ""}</div></td>
            <td class="small">${ctx(x)}</td>
            <td class="small">${(x.reasons || []).map(whyNotTagged).join("<br>")}</td>
            <td class="nowrap">${kept ? `<span class="small c-yes">kept by you</span>` : `<button class="add" data-keep="${esc(x.concept_id)}">+ keep</button>`}</td></tr>`; }).join("")}</tbody></table>
         <div class="hint small">A word you keep appears under Add a term; tick there the area for which it counts.</div>`
      : `<p class="muted small">None.</p>`);
  }

  function renderFindings() {
    const res = S.cur, R = S.rev, l = res.findings || [];
    $("#v6-findings").innerHTML = `<h3>AI taxonomy findings <span class="muted">${l.length}</span> ${help("findings")}</h3>` + (l.length ? l.map((f, i) => {
      const d = R.findings[fkey(f)] || "";
      return `<div class="finding"><div><b>${esc(w(f.finding_type))}</b>${f.phrase ? ` “${esc(f.phrase)}”` : ""}${f.concept_name ? ` <span class="muted">term: ${esc(f.concept_name)}</span>` : ""}</div>
        <div class="small">${esc(w(f.proposed_action))}${f.proposed_label ? `: ${esc(f.proposed_label)}` : ""}${f.proposed_value ? ` (${esc(f.proposed_value)})` : ""}${f.facet ? ` <span class="muted">· ${esc(f.facet)}</span>` : ""}${f.area ? ` <span class="muted">· ${esc(f.area)}</span>` : ""}</div>
        ${f.reason ? `<div class="small muted">${esc(f.reason)}</div>` : ""}
        ${f.excerpt ? `<div class="q small">“${esc(cut(f.excerpt, 220))}”</div>` : ""}
        <span class="segs sm">${segD("f-" + i, "accept", "Accept", d === "accept", "ok")}${segD("f-" + i, "reject", "Reject", d === "reject", "ko")}${segD("f-" + i, "later", "Later", d === "later", "ch")}</span></div>`; }).join("")
      + `<div class="hint small">For the people who maintain the taxonomy. These answers do not change the outcome of your review.</div>`
      : `<p class="muted small">None.</p>`);
  }

  function addedHtml() {
    const R = S.rev;
    return R.added_terms.map(id => { const t = S.terms[id] || { term: id, facet: "" }, c = R.added_counts[id] || {};
      return `<span class="chip add">${esc(t.term)} <small>${esc(t.facet || "")}</small>
        <label class="small"><input type="checkbox" data-k="added-adaptation" data-id="${esc(id)}" ${c.adaptation ? "checked" : ""}> counts for adaptation</label>
        <label class="small"><input type="checkbox" data-k="added-mitigation" data-id="${esc(id)}" ${c.mitigation ? "checked" : ""}> counts for mitigation</label>
        <a href="#" class="rm" data-id="${esc(id)}" title="remove">×</a></span>`; }).join("");
  }
  function propsHtml() {
    const p = S.rev.proposals || [];
    return p.length ? p.map((x, i) => `<span class="chip prop">${x.kind === "new" ? "new" : "synonym"} · <b>${esc(x.label)}</b>
      <small>${x.kind === "new" ? esc(x.facet || "") : "of " + esc((S.terms[x.of_id] || {}).term || x.of_id)}${x.note ? " · " + esc(x.note) : ""}</small><a href="#" class="rp" data-i="${i}" title="remove">×</a></span>`).join("")
      : `<span class="muted small">None. Search for a term; if it is not in the taxonomy you can propose it.</span>`;
  }

  function refreshAll() { renderGives(); AREAS.forEach(renderArea); }
  function refreshText() {
    const box = $(".text"), y = box.scrollTop;
    box.outerHTML = textBlock(S.cur, S.rev.added_terms, true); $(".text").scrollTop = y; wireMarks();
  }
  function lists() { $("#added").innerHTML = addedHtml(); $("#props").innerHTML = propsHtml(); }
  function add(id) {
    const R = S.rev;
    if (R.added_terms.includes(id) || (S.cur.tags || []).some(t => t.concept_id === id)) return;
    const t = S.terms[id] || {};
    R.added_terms.push(id);
    R.added_counts[id] = { adaptation: t.role_a === "stand-alone", mitigation: t.role_m === "stand-alone" };
    refreshText(); lists(); renderDropped(); refreshAll();
  }

  function wire() {
    const R = S.rev, res = S.cur, side = $(".side.v6");
    side.addEventListener("change", e => {
      const el = e.target, n = el.name || "", k = el.dataset.k || "";
      if (n.startsWith("m-")) { const a = R.areas[n.slice(2)]; a.measure = el.value; if (el.value !== "not_measure") a.measure_reason = ""; if (el.value !== "missed") a.measure_quote = ""; refreshAll(); }
      else if (n.startsWith("p-")) { const ax = n.slice(2), a = R.areas[ax], ai = res[ax] || {};
        a.purpose = el.value; a.purpose_basis = el.value !== "not_stated" && el.value === ai.purpose && ai.purpose_basis && ai.purpose_basis !== "none" ? ai.purpose_basis : ""; refreshAll(); }
      else if (n.startsWith("d-")) { const id = n.slice(2), old = R.tags[id] || {}; R.tags[id] = { d: el.value }; if (old.note && el.value !== "agree") R.tags[id].note = old.note; renderTags(); refreshAll(); }
      else if (n.startsWith("f-")) { R.findings[fkey(res.findings[+n.slice(2)])] = el.value; }
      else if (k === "measure_reason" || k === "purpose_basis") { R.areas[el.dataset.ax][k] = el.value; refreshAll(); }
      else if (k === "tag-reason") { R.tags[el.dataset.id].reason = el.value; refreshAll(); }
      else if (k.startsWith("tag-") && k !== "tag-note") { R.tags[el.dataset.id][k.slice(4)] = el.value; renderTags(); refreshAll(); }
      else if (k.startsWith("added-")) { (R.added_counts[el.dataset.id] ||= {})[k.slice(6)] = el.checked; refreshAll(); }
    });
    side.addEventListener("input", e => {
      const el = e.target, k = el.dataset.k || "";
      if (k === "measure_quote") { R.areas[el.dataset.ax].measure_quote = el.value; renderGives(); }
      else if (k === "pathway_note") { R.pathway_note = el.value; renderGives(); }
      else if (k === "tag-note") R.tags[el.dataset.id].note = el.value;
    });
    side.addEventListener("click", e => {
      const keep = e.target.closest("button[data-keep]"), jump = e.target.closest("a.jump"), rm = e.target.closest("a.rm"), rp = e.target.closest("a.rp");
      if (keep) add(keep.dataset.keep);
      else if (jump) { e.preventDefault(); flash($(`mark[data-id="${CSS.escape(jump.dataset.id)}"]`)); }
      else if (rm) { e.preventDefault(); const id = rm.dataset.id; R.added_terms = R.added_terms.filter(x => x !== id); delete R.added_counts[id]; refreshText(); lists(); renderDropped(); refreshAll(); }
      else if (rp) { e.preventDefault(); R.proposals.splice(+rp.dataset.i, 1); lists(); }
    });
    wireMarks();
    lists();

    // add a term, propose a term or a synonym (same as the v4 form)
    const q = $("#q"); let timer = null;
    const showHits = () => {
      const v = q.value.trim(), hits = search(v);
      $("#hits").innerHTML = hits.map(h => `<div class="hit"><button class="add" data-id="${esc(h.t.id)}">+ add</button><b>${esc(h.t.term)}</b>
        <span class="muted small">${esc(h.t.facet)} · ${esc(h.t.id)}${h.via ? " · synonym “" + esc(h.via) + "”" : ""}</span></div>`).join("")
        + (v.length >= 2 ? `<div class="notfound"><span>${hits.length ? "Not the right one?" : "Not in the taxonomy."}</span>
          <button id="pn">Propose “${esc(v)}” as a new term</button><button id="ps">as a synonym</button><div id="pform"></div></div>` : "");
      $$("#hits button.add").forEach(b => b.onclick = () => { add(b.dataset.id); q.value = ""; $("#hits").innerHTML = ""; });
      if ($("#pn")) $("#pn").onclick = () => propForm("new", v);
      if ($("#ps")) $("#ps").onclick = () => propForm("synonym", v);
    };
    q.oninput = () => { clearTimeout(timer); timer = setTimeout(showHits, 120); };
    const propForm = (kind, lab) => {
      $("#pform").innerHTML = kind === "new"
        ? `<div class="pf"><select id="pf"><option value="">facet…</option>${S.facets.map(f => `<option>${esc(f)}</option>`).join("")}</select>
           <input id="pnote" placeholder="definition or reason (optional)"><button class="primary" id="pok">Add</button></div>`
        : `<div class="pf"><input id="pof" placeholder="synonym of… (type a term)" autocomplete="off"><div id="pofhits" class="hits mini"></div>
           <input id="pnote" placeholder="note (optional)"><button class="primary" id="pok">Add</button></div>`;
      let of = null;
      if (kind === "synonym") {
        $("#pof").oninput = () => { of = null; $("#pofhits").innerHTML = search($("#pof").value).slice(0, 6).map(h => `<div class="hit pick" data-id="${esc(h.t.id)}"><b>${esc(h.t.term)}</b> <span class="muted small">${esc(h.t.facet)}</span></div>`).join("");
          $$("#pofhits .pick").forEach(d => d.onclick = () => { of = d.dataset.id; $("#pof").value = S.terms[of].term; $("#pofhits").innerHTML = ""; }); };
      }
      $("#pok").onclick = () => {
        const p = { kind, label: lab, note: $("#pnote").value.trim() };
        if (kind === "new") p.facet = $("#pf").value;
        else { if (!of) { $("#pof").focus(); $("#pof").classList.add("bad"); return; } p.of_id = of; }
        R.proposals.push(p); q.value = ""; $("#hits").innerHTML = ""; lists();
      };
    };
    S.pickApi = { add, propose: (kind, text) => { q.value = text; showHits(); propForm(kind, text); q.scrollIntoView({ block: "center", behavior: "smooth" }); } };
    $("#brw").onclick = e => { e.preventDefault(); const t = $("#tree"); t.hidden = !t.hidden; if (!t.dataset.on) { t.dataset.on = 1; t.innerHTML = treeHtml(); wireTree(t, add); } };
    $("#save").onclick = () => save(false);
    $("#sub").onclick = () => save(true);
  }

  async function save(submit) {
    if (needName()) return;
    const R = S.rev, res = S.cur, msg = $("#msg");
    if (S.storeOk === false) { msg.textContent = "The review store does not take reviews of this batch yet. Nothing was saved."; msg.className = "small bad"; return; }
    R.comment = $("#cm").value;
    const me = reviewResult(res, R), was = S.mine[res.id];
    if ((submit || (was && was.submitted)) && me.missing.length) { msg.textContent = me.missing[0]; msg.className = "small bad"; return; }
    const B = S.batches.find(b => b.id === S.batch) || {};
    const answers = { ...JSON.parse(JSON.stringify(R)),
      computed: { adaptation_level: me.adaptation, mitigation_level: me.mitigation, comparison_area: me.area, comparison_level: me.level,
                  marker_outcome: me.marker, marker_outcome_detail: me.detail, review_outcome: me.review, complete: me.complete },
      basis: { batch_version: B.v || "", prompt: res.prompt || "" } };
    const row = { result_id: res.id, batch_id: S.batch, submitted: submit || !!(was && was.submitted), answers };
    msg.className = "small"; msg.textContent = "Saving…"; $("#save").disabled = $("#sub").disabled = true;
    let saved;
    try { saved = await api("/review", row); }
    catch (e) { msg.textContent = e.message; msg.className = "small bad"; $("#save").disabled = $("#sub").disabled = false; return; }
    S.mine[res.id] = saved;
    const c = S.status[res.id] ||= { started: 0, submitted: 0 };     // update counts here; the full refresh runs in the background
    if (!was) c.started++;
    if (row.submitted && !(was && was.submitted)) c.submitted++;
    refreshState();
    if (!submit) { msg.textContent = "Saved."; $("#save").disabled = $("#sub").disabled = false; tabs(); return; }
    const next = S.list.find(r => bucket(r) === "todo" && r.id !== res.id);
    location.hash = next ? "#/r/" + encodeURIComponent(next.id) : "#/list/todo";
  }

  // ---------------------------------------------------------------- answers in words (comparison view and file)
  function measureText(res, a, ax) {
    const r = a.areas[ax];
    if (!infoOf(res, a, ax)) return "no climate information";
    if (r.measure === "agree") return (res[ax] || {}).measure === "described" ? "agree: a measure" : "agree: no measure";
    if (r.measure === "not_measure") return "not a measure: " + label(NOT_MEASURE, r.measure_reason);
    if (r.measure === "missed") return `measure missed: “${r.measure_quote}”`;
    return "";
  }
  function purposeText(res, a, ax, c) {
    const r = a.areas[ax];
    if (c.A[ax].measure !== "described") return "";
    if (!r.purpose) return "";
    return w(r.purpose);
  }
  function tagText(t, d) {
    if (!tagChanged(t, d)) return "agree";
    if (d.d === "refuse") return "refused: " + label(REFUSE, d.reason) + (d.note ? ` (${d.note})` : "");
    return "changed: " + TAG_FIELDS.filter(f => d[f] != null && d[f] !== t[f]).map(f => `${FIELD_WORDS[f]} ${w(t[f]) || "none"} → ${w(d[f]) || "none"}`).join("; ") + (d.note ? ` (${d.note})` : "");
  }
  const aiMeasure = (res, ax) => { const a = res[ax] || {}; return !a.information ? "" : a.measure === "described" ? `“${a.measure_quote || ""}”${a.measure_kind ? " (" + w(a.measure_kind) + ")" : ""}` : "no measure"; };
  const aiPurpose = (res, ax) => { const a = res[ax] || {}; return !a.information ? "" : w(a.purpose || "not_stated"); };
  const proposalText = p => p.kind === "new" ? `new term: ${p.label}${p.facet ? " (" + p.facet + ")" : ""}` : `synonym: ${p.label} -> ${(S.terms[p.of_id] || {}).term || p.of_id}`;
  const addedHow = (a, id) => { const c = (a.added_counts || {})[id] || {}, f = [c.adaptation ? "adaptation" : "", c.mitigation ? "mitigation" : ""].filter(Boolean).join(" and ");
    return f ? `counts for ${f}` : "does not count"; };
  const addedText = a => (a.added_terms || []).map(id => `${(S.terms[id] || {}).term || id} (${addedHow(a, id)})`);

  // ---------------------------------------------------------------- both reviews side by side
  function compare(res) {
    const v = (S.others[res.id] || []).slice(0, 2), ai = aiResult(res);
    const A = v.map(r => norm(r.answers, res)), C = A.map(a => reviewResult(res, a)), ag = agree(res.id);
    const cell = (x, y) => x === y ? "same" : "diff";
    const row = (th, aiH, vals, raw) => `<tr><th>${th}</th><td class="small">${aiH}</td>${vals.map(x => `<td class="${cell(raw ? raw[0] : vals[0], raw ? raw[1] : vals[1])} small">${x}</td>`).join("")}</tr>`;
    const addedAll = [...new Set(A.flatMap(a => a.added_terms || []))];
    const sec = t => `<tr class="sec"><th colspan="4">${t}</th></tr>`;
    $("#main").innerHTML = navBar(res) + `<div class="notice ${ag ? "good" : ""}">${ag ? "The two reviewers agree on the levels and the marker answer." : "The two reviewers differ on a level or on the marker answer. Differences are marked in red."}</div>
    <div class="cols">${textBlock(res, addedAll)}<div class="side"><section class="card flush">
      <table class="cmp"><thead><tr><th></th><th>AI</th><th>${esc(v[0].reviewer)}</th><th>${esc(v[1].reviewer)}</th></tr></thead><tbody>
      ${AREAS.map(ax => row(AX[ax] + " level" + (ax === "adaptation" ? " " + help("levels") : ""), levelCell(ai[ax], ai.purpose[ax]), C.map(c => levelCell(c[ax], c.purpose[ax])), C.map(c => c[ax]))).join("")}
      ${row("Marker answer " + help("marker-answer"), markerCell(ai.marker, ai.detail), C.map(c => markerCell(c.marker, c.detail)), C.map(c => c.marker))}
      ${row("Outcome of the review " + help("outcome"), "", C.map(c => esc(c.review || "incomplete")))}
      ${AREAS.map(ax => sec(AX[ax]) + row("Climate measure", esc(aiMeasure(res, ax)), A.map(a => esc(measureText(res, a, ax))))
        + row("Purpose", esc(aiPurpose(res, ax)), A.map((a, i) => esc(purposeText(res, a, ax, C[i]) || "not needed")))).join("")}
      ${sec("AI tags")}
      ${(res.tags || []).map(t => row(`${esc(t.concept_name)} <span class="muted small">${esc(t.facet)}</span>`, esc([w(t.adaptation), w(t.mitigation)].join(" / ")), A.map(a => esc(tagText(t, dec(a, t)))))).join("") || `<tr><td colspan="4" class="muted">None.</td></tr>`}
      ${sec("Terms added")}
      ${addedAll.length ? addedAll.map(id => row(esc((S.terms[id] || {}).term || id), "", A.map(a => (a.added_terms || []).includes(id) ? esc("added, " + addedHow(a, id)) : ""))).join("") : `<tr><td colspan="4" class="muted">None.</td></tr>`}
      ${sec("AI taxonomy findings")}
      ${(res.findings || []).map(f => row(`${esc(w(f.finding_type))} <span class="muted small">${esc(f.phrase || f.concept_name || "")}</span>`, esc(w(f.proposed_action)), A.map(a => esc(a.findings[fkey(f)] || "later")))).join("") || `<tr><td colspan="4" class="muted">None.</td></tr>`}
      ${sec("Pathway, proposals and comments")}
      ${row("Pathway parts to correct", "", A.map(a => esc(a.pathway_note || "none")))}
      ${row("Proposals", "", A.map(a => (a.proposals || []).map(p => esc(proposalText(p))).join("<br>") || "none"))}
      ${row("Comment", "", A.map(a => esc(a.comment || "none")))}
      </tbody></table></section></div></div>`;
    const mk = $(".nav .meta span"); if (mk) mk.insertAdjacentHTML("beforeend", " " + help("marker"));
    wireMarks();
  }

  // ---------------------------------------------------------------- the file: one row per PRMS result
  async function exportFile() {
    const link = $("#exp"), lab = link.textContent; link.textContent = "Preparing…";
    let revs;
    try { [revs] = await Promise.all([api(`/export?batch=${encodeURIComponent(S.batch)}`), loadXlsx(), S.termsReady]); }
    catch (e) { link.textContent = lab; return alert(e.message); }
    const by = {}; revs.forEach(r => (by[r.result_id] ||= []).push(r));
    const RV = ["reviewer", "status", "adaptation level", "mitigation level", "marker answer", "review outcome", "adaptation climate measure",
                "mitigation climate measure", "adaptation purpose", "mitigation purpose", "tags refused", "tags changed", "terms added",
                "findings accepted", "findings rejected", "findings later", "pathway parts to correct", "proposed new terms / synonyms", "comment", "date"];
    const one = (r, res) => {
      if (!r) return Array(RV.length).fill("");
      const a = norm(r.answers, res), c = reviewResult(res, a), f = res.findings || [];
      const fd = x => f.filter(z => (a.findings[fkey(z)] || "later") === x).map(z => `${w(z.finding_type)}: ${z.phrase || z.concept_name || ""}`).join("; ");
      return [r.reviewer, r.submitted ? "submitted" : "draft",
        c.complete ? c.adaptation : "incomplete", c.complete ? c.mitigation : "incomplete", c.complete ? outcomeLabel(c.marker, c.detail) : "incomplete", c.review,
        measureText(res, a, "adaptation"), measureText(res, a, "mitigation"), purposeText(res, a, "adaptation", c), purposeText(res, a, "mitigation", c),
        (res.tags || []).filter(t => dec(a, t).d === "refuse").map(t => `${t.concept_name}: ${tagText(t, dec(a, t)).replace(/^refused: /, "")}`).join("; "),
        (res.tags || []).filter(t => dec(a, t).d === "change" && tagChanged(t, dec(a, t))).map(t => `${t.concept_name}: ${tagText(t, dec(a, t)).replace(/^changed: /, "")}`).join("; "),
        addedText(a).join("; "), fd("accept"), fd("reject"), fd("later"), a.pathway_note || "", (a.proposals || []).map(proposalText).join("; "),
        a.comment || "", r.updated_at || ""];
    };
    const names = (res, ax) => (res.tags || []).filter(t => counts(t[ax])).map(t => `${t.concept_name} (${w(t[ax])})`).join("; ");
    const head = ["result_id", "climate_marker", "level", "type", "title", "description", "AI adaptation level", "AI mitigation level",
      "AI comparison area", "AI marker answer", "AI marker reason", "AI adaptation terms that count", "AI mitigation terms that count",
      "AI adaptation climate measure", "AI mitigation climate measure", "AI adaptation purpose", "AI mitigation purpose", "AI review flags",
      "review status", "reviewers agree", ...RV.map(c => "R1 " + c), ...RV.map(c => "R2 " + c)];
    const tagHead = ["result_id", "term", "concept_id", "facet", "found as", "AI adaptation", "AI mitigation", "AI role in the text", "AI planned or done",
                     "R1 reviewer", "R1 decision", "R2 reviewer", "R2 decision"];
    const findHead = ["result_id", "finding type", "phrase", "term", "proposed action", "proposed label", "facet", "area", "reason", "passage",
                      "R1 reviewer", "R1 decision", "R2 reviewer", "R2 decision"];
    const rows = [], tagRows = [], findRows = [];
    S.list.forEach(res => {
      const v = (by[res.id] || []).slice(0, 2), sub = v.filter(r => r.submitted).length, ag = sub >= 2 ? agree(res.id) : null, ai = aiResult(res);
      const A = v.map(r => norm(r.answers, res));
      rows.push([res.id, res.marker, res.level, res.type, res.title, res.description, ai.adaptation, ai.mitigation, ai.area,
        outcomeLabel(ai.marker, ai.detail), ai.reason, names(res, "adaptation"), names(res, "mitigation"), aiMeasure(res, "adaptation"),
        aiMeasure(res, "mitigation"), aiPurpose(res, "adaptation"), aiPurpose(res, "mitigation"), (res.review_flags || []).join("; "),
        sub >= 2 ? "2 reviews" : sub === 1 ? "1 review" : v.length ? "in progress" : "not reviewed", ag === null ? "" : ag ? "yes" : "no",
        ...one(v[0], res), ...one(v[1], res)]);
      const rv = i => v[i] ? v[i].reviewer : "";
      (res.tags || []).forEach(t => tagRows.push([res.id, t.concept_name, t.concept_id, t.facet, t.detection_excerpt, w(t.adaptation), w(t.mitigation),
        w(t.pathway_role), w(t.status), rv(0), A[0] ? tagText(t, dec(A[0], t)) : "", rv(1), A[1] ? tagText(t, dec(A[1], t)) : ""]));
      [...new Set(A.flatMap(a => a.added_terms || []))].forEach(id => tagRows.push([res.id, (S.terms[id] || {}).term || id, id, (S.terms[id] || {}).facet || "",
        "", "", "", "", "", rv(0), A[0] && A[0].added_terms.includes(id) ? "added, " + addedHow(A[0], id) : "",
        rv(1), A[1] && A[1].added_terms.includes(id) ? "added, " + addedHow(A[1], id) : ""]));
      (res.findings || []).forEach(f => findRows.push([res.id, w(f.finding_type), f.phrase || "", f.concept_name || "", w(f.proposed_action), f.proposed_label || "",
        f.facet || "", f.area || "", f.reason || "", f.excerpt || "", rv(0), A[0] ? A[0].findings[fkey(f)] || "later" : "", rv(1), A[1] ? A[1].findings[fkey(f)] || "later" : ""]));
    });
    const readme = [["Tagging review: " + S.batch + " (CGIAR tagging standard)"], [],
      ["One row per PRMS result on the 'reviews' sheet. R1 and R2 are the two reviewers. Use the filters."],
      ["AI ...", "the AI's answers as recorded by the tagging script (" + ((S.batches.find(b => b.id === S.batch) || {}).prompt || "prompt version in the batch file") + ")"],
      ["levels", "L0 no climate information; L1 climate context only; L2 climate measure, purpose additional or not stated; L3 climate measure, climate the main purpose"],
      ["marker answer", "aligned, marker higher, marker lower, cannot determine (with its reason), no comparison"],
      ["reviewer levels and marker answer", "worked out from the reviewer's answers with the table of the tagging script; the reviewer does not choose them. 'incomplete' = a draft with questions not answered"],
      ["review outcome", "wrong when a level or the marker answer differs from the AI's; minor gap when only tags, terms, the pathway or the purpose differ; captured well when nothing differs"],
      ["reviewers agree", "yes when both reviewers end with the same levels and the same marker answer"],
      ["climate measure", "agree, not a measure (with the reason), or measure missed (with the passage)"],
      ["tags refused / changed", "AI tags the reviewer refused (with the reason) or corrected (stand-alone, anchored, no anchor, not relevant; role in the text; planned or done)"],
      ["terms added", "taxonomy terms the reviewer added, including terms found but not kept, and for which area they count"],
      ["findings", "the AI's taxonomy findings: accept, reject or later (no answer = later). Detail on the 'findings' sheet"],
      ["tags sheet", "one row per AI tag and per term added by a reviewer"],
      ["review status", "not reviewed, in progress, 1 review, 2 reviews"],
      ["blind rule", "another reviewer's answers appear only once both reviews of that result are submitted"],
      ["downloaded", new Date().toISOString().slice(0, 16).replace("T", " ") + " by " + S.me]];
    const sheet = (h, r, wide) => { const ws = XLSX.utils.aoa_to_sheet([h, ...r]);
      ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r.length, c: h.length - 1 } }) };
      ws["!cols"] = h.map(x => ({ wch: wide.test(x) ? 40 : 14 })); return ws; };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet(head, rows, /title|description|reason|terms|tags|measure|purpose|flags|proposed|comment|findings|pathway/), "reviews");
    XLSX.utils.book_append_sheet(wb, sheet(tagHead, tagRows, /found as|decision/), "tags");
    XLSX.utils.book_append_sheet(wb, sheet(findHead, findRows, /phrase|reason|passage/), "findings");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(readme), "read me");
    XLSX.writeFile(wb, `review_${S.batch}.xlsx`);
    link.textContent = lab;
  }

  return { list, open, compare, agree, exportFile, aiResult, reviewResult, compareWith, norm, OUTCOMES, areaLevel, areaRank, markerCode };
})();
