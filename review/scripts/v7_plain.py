# The plain form (asked by Lolita on 27 Nov 2026), applied by make_v7.py as its last step on the text of v7.js:
#   - short sentences, close to spoken English, for someone who opens the page for the first time;
#   - no "?" buttons: a word of the standard is pink and underlined, and its explanation opens when you point at it;
#   - no introduction card; the flags are shown only when a text has some;
#   - question 1: one table "Terms that do not count" for the tags that do not count and the words found but not tagged;
#     the answer to question 1 in a pink box;
#   - question 2: Agree / Disagree for each part of the climate pathway, with a free note on Disagree;
#   - question 3 and the result box: the verdict in words, not as a rule code (N1, P3, ...).
# The words of the standard stay (climate-related information, stand-alone, climate anchor, purpose, verdict, ...).
# Nothing changes in what is saved, except path.parts = {rationale, geography, system, intervention, result, links: {d, note}}.


def apply(s):
    def sub(old, new, n=1):
        nonlocal s
        assert s.count(old) == n, (s.count(old), old[:90])
        s = s.replace(old, new)

    def between(start, end, new):
        nonlocal s
        assert s.count(start) == 1, (s.count(start), start[:90])
        i = s.index(start)
        j = s.index(end, i + len(start))
        s = s[:i] + new + s[j:]

    # ------------------------------------------------------------ words: ways, verdicts in words, parts of the pathway
    sub(r'''  const RULE_OPTS = ax => ["N1", "P1", "P2", ax === "adaptation" ? "P3" : "P4", "S1", "S2", CANNOT].map(k => [k, RULE_WORDS[k]]);
''', r'''  // the same rules in plain words, shown instead of the code; the code stays in the list of answers and on hover
  const RULE_PLAIN = {
    N1: "the text shows no purpose",
    P1: "the purpose comes from a named climate plan",
    P2: "the work produces or supports a climate plan, strategy or policy, or builds capacity, tools or finance for it",
    P3: "the adaptation purpose is shown for the work, not only for one component",
    P4: "the mitigation purpose is shown for the work, not only for one component",
    S1: "the purpose is shown only for one component of work that is for something else",
    S2: "the purpose is shown only by a reported result",
    [CANNOT]: "a person must decide with other documents" };
  const RULE_OPTS = ax => ["N1", "P1", "P2", ax === "adaptation" ? "P3" : "P4", "S1", "S2", CANNOT]
    .map(k => [k, k === CANNOT ? `${CANNOT}: ${RULE_PLAIN[k]}` : `${VERDICT[RULE_CODE[k]]}: ${RULE_PLAIN[k]} (${k})`]);
  // question 2 is answered part by part: the five components of the climate pathway and the relationships between them
  const PATH_PARTS = [["rationale", "Climate rationale"], ["geography", "Geography"], ["system", "System or population"], ["intervention", "Intervention"],
                      ["result", "Result"], ["links", "Relationships"]];
  const syncPath = p => { p.d = Object.values(p.parts || {}).some(q => q.d === "disagree") ? "disagree" : "agree"; };
  const pathDisputes = a => [...PATH_PARTS, ["whole", "Whole pathway"]].filter(([k]) => (((a.path || {}).parts || {})[k] || {}).d === "disagree").map(([k, l]) => [l, a.path.parts[k]]);
  // a reviewer's change to a tag, in words
  const youText = (t, d) => tagText(t, d).replace(/^changed: disagree/, "you disagree").replace(/^changed: /, "you changed ").replace(/^removed/, "you removed it");
  const OUT_PLAIN = { "captured well": "right: you agree with everything", "minor gap": "nearly right: small corrections, the result stays the same",
                      wrong: "wrong: with your answers the result changes" };
''')
    sub(r'''  const WAY_WORDS = { 1: "way 1: the text states what the intervention or work is for", 2: "way 2: the intervention is described by the climate rationale",
    3: "way 3: a result of the intervention is reported in relation to the climate rationale", 4: "way 4: a named national or subnational climate plan" };
''', r'''  const WAY_WORDS = { 1: "the text says what the intervention or the work is for", 2: "the intervention is described by the climate rationale",
    3: "the text reports a result of the intervention against the climate rationale", 4: "the work comes from a named national or subnational climate plan" };
''')

    # ------------------------------------------------------------ the saved answers: the pathway, part by part
    sub(r'''    a.path = Object.assign(Q(), a.path || {});
''', r'''    a.path = Object.assign(Q(), a.path || {});
    const hadParts = !!a.path.parts; a.path.parts = a.path.parts || {};
    PATH_PARTS.forEach(([k]) => { a.path.parts[k] = Object.assign({ d: "agree", note: "" }, a.path.parts[k] || {}); });
    if (!hadParts && a.path.d === "disagree") a.path.parts.whole = { d: "disagree", note: a.path.note || "" };   // an answer saved on the whole pathway
    syncPath(a.path);
''')
    sub(r'''missing.push(`${AX[ax]}, verdict: choose the rule of Rule 8 that decides.`)''',
        r'''missing.push(`${AX[ax]}: you disagree on the verdict. Choose the right answer in the list.`)''')
    sub(r'''missing.push(`${AX[ax]}: the verdict was not assessed. Choose Disagree on the verdict, then the rule of Rule 8 that decides.`)''',
        r'''missing.push(`${AX[ax]}: there is no verdict yet. Choose Disagree on the verdict, then the right answer in the list.`)''')
    sub(r'''missing.push(`${AX[ax]}: you say that no purpose is shown, so only N1 or Cannot be determined can decide.`)''',
        r'''missing.push(`${AX[ax]}: you say that no purpose is shown, so the verdict can only be Not targeted (0) or Cannot be determined.`)''')
    sub(r'''missing.push(`${AX[ax]}: you say that a purpose is shown, so N1 cannot decide. Choose the rule of Rule 8 that decides.`)''',
        r'''missing.push(`${AX[ax]}: you say that a purpose is shown, so the verdict cannot be Not targeted (0). Choose the right answer in the list.`)''')
    between('''  function disagreements(res, R) {''', '''  // captured well / minor gap / wrong''', r'''  function disagreements(res, R) {
    const out = [], nt = q => q.note ? ` (“${q.note}”)` : "";
    (res.tags || []).forEach(t => { const d = dec(R, t); if (tagChanged(t, d)) out.push(`Question 1, ${t.concept_name}: ${youText(t, d)}`); });
    (R.added_terms || []).forEach(id => out.push(`Question 1, term added: ${(S.terms[id] || {}).term || id} (${addedHow(R, id)})`));
    pathDisputes(R).forEach(([l, q]) => out.push(`Question 2, ${l.toLowerCase()}${nt(q)}`));
    AREAS.forEach(ax => { const r = R.areas[ax];
      if (r.pu.d === "disagree") out.push(`Question 3, ${ax} purpose: ${r.pu.value || (extPurpose(res, ax) === "shown" ? "not shown" : "shown")}${nt(r.pu)}`);
      if (r.vd.d === "disagree") out.push(`Question 3, ${ax} verdict: ${r.vd.value ? `${verdictOfRule(r.vd.value).label}, ${RULE_PLAIN[r.vd.value] || r.vd.value}` : "not chosen yet"}${nt(r.vd)}`); });
    return out;
  }
''')

    # ------------------------------------------------------------ the explanations, in plain words
    between('''  const HELP = {''', '''  // "?" boxes open on hover where the screen has a mouse''', r'''  // [title, text, optional table, section of rules7.html when it is not the key]
  const HELP = {
    marker: ["assigned marker", "The climate marker already recorded for this work, here in PRMS: Principal (2), Significant (1) or Not targeted (0). PRMS has one marker for adaptation and mitigation together. You do not change it here. The page only compares it with the verdict. When no marker is recorded, it is not counted as 0."],
    verdict: ["verdict", "The marker that the text supports, for adaptation and for mitigation. You do not pick it yourself: it follows from your answer on the purpose.",
      `<table class="hlp-t"><tr><th>Verdict</th><th>When</th></tr>
        <tr><td>Not targeted (0)</td><td>The text shows no purpose.</td></tr>
        <tr><td>Principal (2)</td><td>The purpose comes from a named climate plan. Or the work produces or supports a climate plan, strategy or policy. Or the purpose is shown for the work, not only for one component.</td></tr>
        <tr><td>Significant (1)</td><td>The purpose is shown only for one component of work that is for something else. Or it is shown only by a reported result.</td></tr>
        <tr><td>Cannot be determined</td><td>The text does not say what the work did, or it can be read in two ways. A person decides with other documents.</td></tr></table>`],
    "climate-information": ["climate-related information", "The terms that count for adaptation or for mitigation: stand-alone terms, and context-dependent terms that the text anchors. If no term counts, the text holds no climate-related information."],
    purpose: ["purpose", "What the text says the work is for. A text can show a climate purpose in four ways. One: it says what the intervention or the work is for. Two: it describes the intervention by the climate rationale, as in “drought-tolerant maize”. Three: it reports a result of the intervention against the climate rationale. Four: the work comes from a named national or subnational climate plan. A general label alone, such as “climate-smart” or “resilient”, shows no purpose."],
    "climate-rationale": ["climate rationale", "The climate hazard or the emission source that the work responds to. For example drought, or methane from livestock.", "", "pathway"],
    rule: ["verdict", "The first situation that fits gives the verdict: no purpose, then Principal, then Significant, otherwise Cannot be determined. When the text was read twice and the two readings do not agree, the verdict is Cannot be determined.", "", "rule"],
    "stand-alone": ["stand-alone term", "A term whose meaning is already about climate, such as drought or greenhouse gas inventory. It counts on its own.", "", "anchors"],
    anchored: ["anchored", "Some terms are also used outside climate work: irrigation, yield, maize. They are context-dependent. Such a term counts only when the text gives it a climate anchor. Then it is anchored. Point at the value in the table to see the sentence.", "", "anchors"],
    "climate-anchor": ["climate anchor", "The words in the text that link a context-dependent term to climate: a climate hazard, an emission source, a greenhouse gas. For example, a text that speaks of drought and then of irrigation anchors irrigation to adaptation.", "", "anchors"],
    tags: ["tags", "Each taxonomy term found in the text, with the words it was found as. Agree, or disagree to fix a value, remove the tag or write a note."],
    colours: ["colours in the text", "Yellow: a term that counts. Grey: a term that does not count. Blue: a term you added. Purple, dotted: a proposal, words that the taxonomy does not have yet. Click a colour to find its line on the right."],
    "add-term": ["add a term", "Use this when a taxonomy term is in the text and is not in the tables above. Search for it, or select the words in the text. Click + add, then tick adaptation or mitigation. If the words are not in the taxonomy, you can propose them: they go to question 4."],
    pathway: ["climate pathway", "The climate story the text tells, in five parts: the climate rationale (why action is needed), the geography, the system or population exposed, the intervention (what is done) and the result (what comes out of it), with the relationships the text gives between them. The system or population is who or what is exposed to the climate issue, not the organisation that does the work."],
    flags: ["flags", "Points to look at first. For example, the text was read twice and the two readings do not agree. A flag is not an error."],
    comparison: ["comparison with the assigned marker", "Consistent: the verdict and the assigned marker are the same. The text supports a lower marker: the assigned marker is higher than the verdict. The text supports a higher marker: it is lower. Marker missing: no marker is recorded. Not compared: the verdict cannot be determined. PRMS has one marker for both areas, so it is compared with the higher of the two verdicts. This is a signal to look closer. It does not say the assigned marker is wrong."],
    outcome: ["what your review says", "Right: you agree with everything. Nearly right: you corrected tags, the pathway or the purpose, and the verdicts and the comparison stay the same. Wrong: with your answers a verdict or the comparison changes."],
    proposals: ["proposals for the taxonomy", "Words of the text that the taxonomy does not have yet, as a new term or as a synonym of a term it has. Say yes or no to each one, and add your own. They go to the people who look after the taxonomy. They do not change the result for this text."],
  };
''')
    sub(r'''  // ---------------------------------------------------------------- small pieces of display
''', r'''  // a word of the standard in pink and underlined: point at it (or tap it) and its explanation opens. It replaces the "?".
  const tip = (label, key) => { const h = HELP[key] || [key, ""];
    return `<details class="hlp term"><summary aria-label="Explain: ${esc(h[0])}">${label}</summary><span class="hlp-b">${esc(h[1])}${h[2] || ""} <a href="rules7.html#${esc(h[3] || key)}" target="_blank" rel="noopener">More on the Rules page</a></span></details>`; };

  // ---------------------------------------------------------------- small pieces of display
''')
    sub(r'''  const verdictCell = (label, rule) => label ? `<span class="lv lv-${VD_CLASS[label] || "L1"}">${esc(label)}</span>${rule && rule !== label ? ` <span class="small">by ${esc(rule)}</span>` : ""}` : "";''',
        r'''  const verdictCell = (label, rule) => label ? `<span class="lv lv-${VD_CLASS[label] || "L1"}">${esc(label)}</span>${rule && RULE_PLAIN[rule] ? ` <span class="small vwhy" title="${esc(RULE_WORDS[rule] || "")}">${esc(RULE_PLAIN[rule])}</span>` : ""}` : "";''')
    sub(r'''placeholder="note (optional): what is wrong, with the words of the text"''', r'''placeholder="What is wrong? You can quote the text (optional)"''')
    sub(r'''${help("colours")}''', r'''${tip("what the colours mean", "colours")}''')
    sub(r'''mk.insertAdjacentHTML("beforeend", " " + help("marker"))''', r'''mk.insertAdjacentHTML("beforeend", " " + tip("what is this?", "marker"))''', 2)

    # ------------------------------------------------------------ the page: no introduction, plain headings
    between('''      <section class="card intro" id="v6-intro">''', '''      ${qHead(1, ''',
            r'''      ${(res.review_flags || []).length ? `<div class="card flags small" id="v6-flags"><b>${tip("To look at first", "flags")}</b> ${res.review_flags.map(f => `<span class="flag">${esc(f)}</span>`).join("")}</div>` : ""}
''')
    between('''      ${qHead(1, ''', '''      <section class="card flush" id="v6-tags"></section>''',
            r'''      ${qHead(1, "What climate-related information does the text contain?", "These are the taxonomy terms found in the text. For each one: does it say the text is about adaptation, about mitigation, or neither?")}
''')
    between('''      ${qHead(2, ''', '''      <section class="card" id="v6-path"></section>''',
            r'''      ${qHead(2, "What climate pathway does the text describe?", "The climate story of the text, in five parts. Check each part.")}
''')
    between('''      ${qHead(3, ''', '''      ${AREAS.map(ax => `<section class="card area"''',
            r'''      ${qHead(3, "Is the information consistent with the assigned climate marker?", `Does the text show an adaptation purpose, or a mitigation purpose? From your answer the page works out the verdict, then compares it with the assigned marker <b>${esc(res.marker || (res.part ? "none: a plan carries no marker" : "not provided"))}</b>. The comparison is in the yellow box at the end.`)}
''')
    between('''      ${qHead(4, ''', '''      <section class="card" id="v6-props">''',
            r'''      ${qHead(4, "What gaps or errors in the taxonomy does tagging reveal?", "Words of the text that the taxonomy does not have yet. Say yes or no to each one, and add your own. This does not change the result for this text.")}
''')
    sub(r'''      <section class="card" id="v6-dropped"></section>
''', '')
    sub(r'''<section class="card" id="v6-info"></section>''', r'''<section class="card answer" id="v6-info"></section>''')
    between('''      <section class="card" id="v6-add">''', '''        <input id="q" class="search"''',
            r'''      <section class="card" id="v6-add"><h3>${tip("Add a term", "add-term")}</h3>
        <div class="small muted">Is a taxonomy term in the text missing above? Search for it, click + add, then tick adaptation or mitigation.</div>
''')
    between('''      <section class="card" id="v6-props">''', '''      <section class="card" id="v6-comment">''',
            r'''      <section class="card" id="v6-props"><h3>${tip("Proposals for the taxonomy", "proposals")}</h3>
        <div id="v6-found"></div>
        <div class="small muted" style="margin-top:10px">Your own proposals. To add one, search under Add a term in question 1: when the word is not in the taxonomy, you can propose it there.</div><div id="props" class="chips"></div></section>
''')
    sub(r'''<h3>What your answers give <span class="small muted">(the final decision for this text)</span></h3>''', r'''<h3>The result for this text</h3>''')

    # ------------------------------------------------------------ the answer to question 1, in a pink box
    between('''  function renderInfo() {''', '''  // near Submit, always open in a yellow frame''', r'''  function renderInfo() {
    const res = S.cur, R = S.rev;
    const has = Object.fromEntries(AREAS.map(ax => [ax, countsFor(res, R, ax).length > 0])), unc = unclearOf(res, R);
    const area = has.adaptation && has.mitigation ? "adaptation and mitigation" : has.adaptation ? "adaptation" : has.mitigation ? "mitigation"
      : unc.length ? "an unclear area" : "neither adaptation nor mitigation";
    $("#v6-info").innerHTML = `<b>Answer to question 1: the text contains climate-related information on ${area}.</b>
      ${unc.length ? `<div class="small">The area is not clear for: ${unc.map(t => esc(t.concept_name)).join(", ")}.</div>` : ""}`;
  }

''')

    # ------------------------------------------------------------ the result box, in words
    between('''  function renderGives() {''', '''  // question 3, one area: the purpose (Rule 7)''', r'''  function renderGives() {
    const res = S.cur, R = S.rev, ai = aiResult(res), me = reviewResult(res, R), box = $("#v6-gives-b");
    if (!box) return;
    const d = (a, b) => a !== b ? "diff" : "", dis = disagreements(res, R);
    const marker = esc(res.marker || (res.part ? "none: a plan carries no marker" : "not provided"));
    box.innerHTML = `<p class="small muted">The page works this out from your answers. You do not fill it in.</p>
      <table class="lvl"><thead><tr><th></th><th>The tagging says</th><th>You say</th></tr></thead><tbody>
      ${AREAS.map(ax => `<tr><th>${AX[ax]} ${ax === "adaptation" ? tip("verdict", "verdict") : "verdict"}</th><td>${verdictCell(ai[ax], extRule(res, ax))}</td><td class="${d(ai[ax], me[ax])}">${verdictCell(me[ax], me.V[ax].rule)}</td></tr>`).join("")}
      <tr class="pm"><th>${tip("Assigned marker", "marker")}</th><td>${marker}</td><td>${marker}</td></tr>
      <tr><th>${tip("Comparison", "comparison")}</th><td>${cmpCell(ai.result)}</td><td class="${d(ai.result, me.result)}">${cmpCell(me.result)}</td></tr>
      </tbody></table>
      <p class="small">${esc(me.reason)}</p>
      ${me.V.adaptation.code === 2 && me.V.mitigation.code === 2 ? `<div class="notice small">Principal for both adaptation and mitigation is accepted only when each one rests on different words of the text.</div>` : ""}
      <div class="small dis"><b>${dis.length ? `You disagree on ${dis.length} point${dis.length > 1 ? "s" : ""}:` : "You agree with everything."}</b>
        ${dis.length ? `<ul>${dis.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>
      ${me.missing.length ? `<div class="small bad"><b>Still to answer before you submit</b><ul class="missing">${me.missing.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${me.complete ? `<div class="outcome">${tip("Your review says", "outcome")} the tagging of this text is <span class="rv rv-${esc(me.review.replace(/ /g, "-"))}">${esc(OUT_PLAIN[me.review] || me.review)}</span></div>` : ""}`;
  }

''')

    # ------------------------------------------------------------ question 3 and question 2
    between('''  function renderArea(ax) {''', '''  function areaCell(t, ax, d) {''', r'''  function renderArea(ax) {
    const res = S.cur, R = S.rev, ai = res[ax] || {}, r = R.areas[ax], me = reviewResult(res, R), an = ax === "adaptation" ? "an adaptation" : "a mitigation";
    const up = x => x.charAt(0).toUpperCase() + x.slice(1);
    let h = `<div class="ah"><span class="ax">${AX[ax]}</span></div>`;
    // the purpose: is one shown, in which way, with which words
    const wq = ai.way_quotes || {}, ways = (ai.ways || []).map(String);
    const how = ways.map(k => `<div class="small">${esc(up(WAY_WORDS[k] || "way " + k))}: “${esc(cut(wq["way" + k] || "", 220))}”</div>`).join("")
      || (ai.policy_quote ? `<div class="small">“${esc(cut(ai.policy_quote, 220))}”</div>` : "");
    const pShown = `<span class="muted">The tagging says:</span> `
      + (ai.purpose === "shown" ? `<b>yes</b>${how}` : ai.purpose === "not assessed" ? `<span class="muted">not checked: the text was not read for its purpose</span>` : `<b>no</b>`)
      + (ai.rationale_quote ? `<div class="small muted">Climate rationale: “${esc(cut(ai.rationale_quote, 200))}”</div>` : "");
    h += question("pu-" + ax, `Does the text show ${an} ${tip("purpose", "purpose")}?`, null, pShown, r.pu, PURPOSE_OPTS);
    // the way that shows the purpose, asked when the reviewer's answer is that a purpose is shown
    if (me.P[ax] === "shown") h += `<div class="q1"><div class="small">How does the text show it? Tick all that apply.</div>
      ${Object.keys(WAY_WORDS).map(k => `<div><label class="small"><input type="checkbox" data-k="way-${k}" data-ax="${ax}" ${r.wy.includes(k) ? "checked" : ""}> ${esc(up(WAY_WORDS[k]))}</label></div>`).join("")}</div>`;
    // the verdict, with the words it rests on
    const diff = readingsDiffer(res, ax);
    const vShown = `<span class="muted">The tagging says:</span> ` + (ai.verdict ? verdictCell(ai.verdict, ai.rule) : `<span class="muted">no verdict</span>`)
      + (ai.rule_quote ? `<div class="small">“${esc(cut(ai.rule_quote, 240))}”</div>` : "")
      + (ai.verdict_reason ? `<div class="small muted">${esc(ai.verdict_reason)}</div>` : "")
      + (diff ? `<div class="small muted">The text was read twice and the two readings do not agree, so the verdict is Cannot be determined. If the text is clear to you, choose Disagree and pick the right answer.</div>` : "")
      + (me.V[ax].label !== (ai.verdict || "") ? `<div class="small you">With your answers: ${esc(me.V[ax].label)}${RULE_PLAIN[me.V[ax].rule] ? ", " + esc(RULE_PLAIN[me.V[ax].rule]) : ""}</div>` : "");
    h += question("vd-" + ax, `Which marker does the text support for ${ax}? This is the ${tip("verdict", "verdict")}.`, null, vShown, r.vd, RULE_OPTS(ax));
    $("#v6-area-" + ax).innerHTML = h;
  }
  function renderPath() { $("#v6-path").innerHTML = pathwayHtml(S.cur, S.rev.path.parts); }

  // the climate pathway; with P (the reviewer's answers by part) each part has Agree / Disagree and, on Disagree, a free note
  function pathwayHtml(res, P) {
    const A = res.adaptation || {}, M = res.mitigation || {};
    const L = x => (x || []).length ? (x || []).map(esc).join("; ") : `<span class="muted">not described</span>`;
    const links = ax => (res.links || []).filter(l => l.area === ax).map(l => `<div>${esc(l.from_name)} → ${esc(l.to_name)} <span class="muted">(${esc(w(l.kind))}, ${esc(w(l.how))})</span>${l.quote ? `<div class="q">“${esc(cut(l.quote, 200))}”</div>` : ""}</div>`).join("") || `<span class="muted">none</span>`;
    const geo = res.geography ? `${esc(res.geography)} <span class="muted">(${esc(res.geography_source || "")})</span>` : `<span class="muted">not described</span>`;
    const cit = res.countries_in_text && res.countries_in_text !== res.geography ? `<div class="small muted">Countries named in the text: ${esc(res.countries_in_text)}</div>` : "";
    const type = a => (a.intervention_type || []).length ? `<div class="small muted">Type: ${(a.intervention_type || []).map(esc).join("; ")}</div>` : "";
    const ask = k => { if (!P) return ""; const q = P[k] || { d: "agree" }, dis = q.d === "disagree";
      return `<td class="nowrap"><span class="segs sm">${segD("pp-" + k, "agree", "Agree", !dis, "ok")}${segD("pp-" + k, "disagree", "Disagree", dis, "ko")}</span></td>`; };
    const note = k => { const q = P && P[k]; return q && q.d === "disagree"
      ? `<tr class="sub"><td colspan="4"><input class="wide" data-pp="${esc(k)}" placeholder="What is wrong? Write it in your own words" value="${esc(q.note || "")}"></td></tr>` : ""; };
    const row = (k, th, a, m) => `<tr><th>${th}</th>${m == null ? `<td colspan="2">${a}</td>` : `<td>${a}</td><td>${m}</td>`}${ask(k)}</tr>${note(k)}`;
    return `<h3>${tip("Climate pathway", "pathway")}</h3>
      ${P ? `<div class="hint small">Agree with each part, or disagree and say what is wrong.</div>` : ""}
      <table class="pway small"><thead><tr><th></th><th>Adaptation</th><th>Mitigation</th>${P ? "<th></th>" : ""}</tr></thead><tbody>
      ${row("rationale", tip("Climate rationale", "climate-rationale"), L(A.rationale), L(M.rationale))}
      ${row("geography", "Geography", geo + cit, null)}
      ${row("system", "System or population", L(A.system_or_population), L(M.system_or_population))}
      ${row("intervention", "Intervention", L(A.intervention) + type(A), L(M.intervention) + type(M))}
      ${row("result", "Result", L(A.result), L(M.result))}
      ${row("links", "Relationships", links("adaptation"), links("mitigation"))}
      ${P && P.whole ? row("whole", "Whole pathway", `<span class="muted">your earlier answer on the pathway as a whole</span>`, null) : ""}
      </tbody></table>`;
  }

''')

    # ------------------------------------------------------------ question 1: the terms, in two tables
    between('''  function tagRow(t, d, extra = "") {''', '''  // why a word found by the term search is not a tag''', r'''  // one tag. compact: a tag that does not count, in the table "Terms that do not count" (term, found as, why, answer)
  function tagRow(t, d, extra = "", compact = false) {
    const id = t.concept_id, cls = [d.d === "refuse" ? "disagree" : "", d.d === "change" ? "changed" : ""].join(" "), n = compact ? 4 : 7;
    const shown = (f, v) => { const mine = d.d === "change" && d[f] != null && d[f] !== v ? d[f] : null; return esc(w(v)) + (mine ? ` → <span class="you">${esc(w(mine))}</span>` : ""); };
    const sel = (f, opts) => `<select data-k="tag-${f}" data-id="${esc(id)}">${[...new Set([t[f], ...opts])].filter(x => x != null && x !== "").map(o => opt(o, w(o), (d[f] != null ? d[f] : t[f]) === o)).join("")}</select>`;
    // Disagree: correct a value, or remove the tag (with the reason), and a note
    const dis = d.d === "change" || d.d === "refuse", bothSA = t.role_adaptation === "stand-alone" && t.role_mitigation === "stand-alone";
    const rm = `<label><input type="checkbox" data-k="tag-remove" data-id="${esc(id)}" ${d.d === "refuse" ? "checked" : ""}> Remove this tag</label>`;
    const sub = !dis ? "" : `<tr class="sub"><td colspan="${n}"><div class="subf">${rm}
        ${d.d === "refuse" ? `<label>Why (optional) <select data-k="tag-reason" data-id="${esc(id)}"><option value="">choose…</option>${[...REFUSE, ...REFUSE_OLD.filter(x => x[0] === d.reason)].map(([v, l]) => opt(v, l, d.reason === v)).join("")}</select></label>`
          : `<label>Adaptation ${sel("adaptation", AREA_OPTS(t.role_adaptation, bothSA))}</label><label>Mitigation ${sel("mitigation", AREA_OPTS(t.role_mitigation, bothSA))}</label>
             <label>Pathway role ${sel("pathway_role", ROLE_OPTS)}</label><label>Intended or realized ${sel("status", STATUS_OPTS)}</label>`}
        <input data-k="tag-note" data-id="${esc(id)}" placeholder="What is wrong? (optional)" value="${esc(d.note || "")}"></div></td></tr>`;
    const def = (S.terms[id] || {}).definition || "";
    const name = `<td><a href="#" class="jump" data-id="${esc(id)}"${def ? ` title="${esc("Taxonomy definition: " + def)}"` : ""}>${esc(t.concept_name)}</a><div class="mono muted">${esc(id)} · ${esc(t.facet)}</div></td>`;
    const act = `<td class="nowrap"><span class="segs sm">${segD("d-" + id, "agree", "Agree", !dis, "ok")}${segD("d-" + id, "disagree", "Disagree", dis, "ko")}</span></td>`;
    if (compact) return `<tr id="t-${esc(id)}" class="${cls}">${name}<td class="small">${foundAs(t)}</td>
      <td class="small">${esc(whyPhrase(S.rev, t))}${tagChanged(t, d) ? `<div class="you">${esc(youText(t, d).replace(/^y/, "Y"))}</div>` : ""}</td>${act}</tr>${sub}`;
    return `<tr id="t-${esc(id)}" class="${cls}">${name}
      <td class="small">${foundAs(t)}</td><td class="small">${areaCell(t, "adaptation", d)}</td><td class="small">${areaCell(t, "mitigation", d)}</td>
      <td class="small">${shown("pathway_role", t.pathway_role)}</td>
      <td class="small">${t.status === "not_applicable" && !(d.d === "change" && d.status && d.status !== t.status) ? `<span class="muted">not applicable</span>` : shown("status", t.status)}${t.status_quote ? `<div class="q" title="${esc(t.status_quote)}">“${esc(cut(t.status_quote, 80))}”</div>` : ""}</td>
      ${act}</tr>${extra}${sub}`;
  }
  // why a tag does not count, in short sentences, from its values (the reviewer's when changed)
  const whyNot = (t, ax, v) => v === "unclear" ? { k: 0, s: "The text does not say if it is about adaptation or mitigation." }
    : v === "no_anchor" ? { k: 1, s: `No climate anchor for ${ax}.` }
    : v === "not_relevant" ? (!t["role_" + ax] || t["role_" + ax] === "n/a" ? { k: 3, s: `Not a ${ax} term.` } : { k: 2, s: `Not about ${ax} in this text.` })
    : { k: 4, s: `${AX[ax]}: ${w(v)}.` };
  const whyPhrase = (R, t) => [...new Set(AREAS.map(ax => whyNot(t, ax, val(R, t, ax))).sort((a, b) => a.k - b.k).map(x => x.s))].join(" ");
  // two tables: the terms that count (an area is stand-alone or anchored), and the terms that do not count, which are the
  // tags with no climate anchor and the words found by the term search and not tagged (same end, another reason)
  function renderTags() {
    const res = S.cur, R = S.rev, all = res.tags || [], left = res.dropped || [];
    const counting = t => counts(val(R, t, "adaptation")) || counts(val(R, t, "mitigation"));
    const yes = all.filter(counting), no = all.filter(t => !counting(t));
    const none = n => `<tr><td colspan="${n}"><strong>None.</strong></td></tr>`;
    const head = `<thead><tr><th>Term</th><th>Found as</th><th>Adaptation</th><th>Mitigation</th><th>Pathway role</th><th>Intended or realized</th><th></th></tr></thead>`;
    const ctx = x => { if (!x.context) return `<span class="muted">not found in the text</span>`;
      const c = x.context, f = x.found_as || "", i = f ? c.toLowerCase().indexOf(f.toLowerCase()) : -1;
      return i < 0 ? esc(c) : esc(c.slice(0, i)) + `<b class="hl-g">${esc(c.slice(i, i + f.length))}</b>` + esc(c.slice(i + f.length)); };
    const leftRow = x => { const kept = R.added_terms.includes(x.concept_id), T = S.terms[x.concept_id] || {}, b = x.better;
      return `<tr class="left"><td><strong${T.definition ? ` title="${esc("Taxonomy definition: " + T.definition)}"` : ""}>${esc(x.concept_name)}</strong><div class="mono muted">${esc(x.concept_id)}${T.facet ? " · " + esc(T.facet) : ""}</div></td>
        <td class="small">${ctx(x)}</td>
        <td class="small">Not tagged. ${(x.reasons || []).map(whyNotTagged).join(" ")}
          ${b ? `<div class="better">A closer term for “${esc(b.phrase)}”: <strong>${esc(b.term)}</strong>
            ${R.added_terms.includes(b.id) ? ` <span class="c-yes">added by you</span>` : ` <button class="add" data-keep="${esc(b.id)}">+ add ${esc(b.term)}</button>`}</div>` : ""}</td>
        <td class="nowrap">${kept ? `<span class="small c-yes">kept by you</span>` : `<button class="add" data-keep="${esc(x.concept_id)}">+ keep</button>`}</td></tr>`; };
    $("#v6-tags").innerHTML = `<h3 class="pad">Terms found in the text <span class="muted">${all.length + left.length}</span></h3>
      <h4 class="pad grp">Terms that count <span class="muted">${yes.length}</span></h4>
      <div class="hint small pad">These terms say that the text holds climate-related information. A term counts when it is a ${tip("stand-alone", "stand-alone")} term, or when it is ${tip("anchored", "anchored")}.</div>
      <table class="tags v6t">${head}<tbody>${yes.map(t => tagRow(t, dec(R, t))).join("") || none(7)}</tbody></table>
      <h4 class="pad grp">Terms that do not count <span class="muted">${no.length + left.length}</span></h4>
      <div class="hint small pad">These terms are in the text, but they do not say that it is about climate. Most often the text gives no ${tip("climate anchor", "climate-anchor")} for them. The reason is on each line. Point at a term to read its definition. If a term should count, choose Disagree, or + keep for a word that was not tagged.</div>
      <table class="tags v6t nocount"><thead><tr><th>Term</th><th>Found as</th><th>Why it does not count</th><th></th></tr></thead>
        <tbody>${no.map(t => tagRow(t, dec(R, t), "", true)).join("")}${left.map(leftRow).join("")}${no.length + left.length ? "" : none(4)}</tbody></table>`;
  }

''')
    between('''  function whyNotTagged(z) {''', '''  // a proposal found in the text, in one line''', r'''  function whyNotTagged(z) {
    const d = String(z.detail || "");
    const given = z.why ? ` <span class="muted">Reason given: “${esc(cut(z.why, 220))}”</span>` : "";
    if (z.narrower) return `A more precise term is already tagged on the same words: <strong>${esc(z.narrower)}</strong>.`;
    return whyText(z, d) + given;
  }
  function whyText(z, d) {
    switch (z.reason) {
      case "not_kept:other": return z.why ? "" : "No reason was given. Look at the definition: if the term fits, click + keep.";
      case "not_kept:narrower_term_tagged": return "A more precise term is already tagged on the same words.";
      case "not_kept:different_meaning": return "The words mean something else here.";
      case "not_kept:part_of_a_name": return "The words are part of a name. If the term still fits, click + keep.";
      case "not_kept:too_generic": return "The word is too general here.";
      case "no_ai_call": return "It was not checked against its definition.";
      case "broader_term_of_a_kept_tag": return `A more precise term is already tagged on the same words${d ? `: ${esc(d)}` : ""}.`;
      case "excerpt_not_in_text": return "The words given for this term are not in the text.";
      case "area_not_addressed_by_the_text": return `The text does not talk about ${esc(d || "this area")}.`;
      default: return esc(dropWord(z.reason)) + (d ? `: ${esc(cut(d, 140))}` : "");
    }
  }
  // the words found and not tagged are in the table "Terms that do not count" (27 Nov 2026): this draws the tables again
  function renderDropped() { renderTags(); }

''')

    # ------------------------------------------------------------ question 4
    sub(r'''`<div class="small muted">Found in the text: accept or reject each one (point at a line to see the passage)</div>`''',
        r'''`<div class="small muted">Found in the text. Point at a line to see the passage.</div>`''')
    sub(r'''`<div class="small muted">Found in the text: none.</div>`''', r'''`<div class="small"><strong>None found in the text.</strong></div>`''')

    # ------------------------------------------------------------ the buttons of the pathway
    sub(r'''      if (n.startsWith("q-")) { const key = n.slice(2), q = qref(R, key); q.d = el.value; if (el.value === "agree") q.value = "";''',
        r'''      if (n.startsWith("pp-")) { const q = R.path.parts[n.slice(3)]; q.d = el.value; if (el.value === "agree") q.note = ""; syncPath(R.path); renderPath(); refreshAll(); }
      else if (n.startsWith("q-")) { const key = n.slice(2), q = qref(R, key); q.d = el.value; if (el.value === "agree") q.value = "";''')
    sub(r'''      if (el.dataset.q && el.dataset.f === "note") { qref(R, el.dataset.q).note = el.value; renderGives(); }''',
        r'''      if (el.dataset.pp) { R.path.parts[el.dataset.pp].note = el.value; renderGives(); }
      else if (el.dataset.q && el.dataset.f === "note") { qref(R, el.dataset.q).note = el.value; renderGives(); }''')

    # ------------------------------------------------------------ the comparison view and the file
    sub(r'''  const pathText = a => qText(a.path, "", "");''',
        r'''  const pathText = a => { const dis = pathDisputes(a); return dis.length ? "disagree: " + dis.map(([l, q]) => l.toLowerCase() + (q.note ? ` (${q.note})` : "")).join("; ") : "agree"; };''')
    sub(r'''row(AX[ax] + " verdict" + (ax === "adaptation" ? " " + help("verdict") : ""),''', r'''row(AX[ax] + " " + (ax === "adaptation" ? tip("verdict", "verdict") : "verdict"),''')
    sub(r'''row("Comparison with the assigned marker " + help("comparison"),''', r'''row(tip("Comparison with the assigned marker", "comparison"),''')
    sub(r'''row("Outcome of the review " + help("outcome"),''', r'''row(tip("What the review says", "outcome"),''')

    for bad in ('help("', "v6-intro", '$("#v6-dropped")'):
        assert bad not in s, ("left in v7.js", bad, s[max(0, s.index(bad) - 80):s.index(bad) + 60])
    return s
