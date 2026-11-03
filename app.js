// Tagging review. Plain JS, no build step. The taxonomy and the results are static files in data/;
// the reviews are stored by a small worker (worker/), which knows the reviewer from their personal link (?r=code).
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const VERDICTS = ["Full", "Partial", "Minimal", "None"];
const COUNTED = ["specific", "conditional_met"];

const S = {
  code: "", me: "", batch: null, batches: [],
  terms: {}, kids: {}, facets: [],
  list: [], byId: {}, status: {}, mine: {}, others: {},   // others: both reviews of finished results, by result id
  tab: "todo", cur: null, rev: null,
};

async function api(path, opts = {}) {
  const r = await fetch(CONFIG.api + path, { ...opts, headers: { "Content-Type": "application/json", "X-Reviewer": S.code } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || r.statusText);
  return body;
}
const getJson = async p => { const r = await fetch(p, { cache: "no-cache" }); if (!r.ok) throw new Error(p + ": " + r.status); return r.json(); };

// ---------------------------------------------------------------- start
async function boot() {
  const u = new URL(location.href), r = u.searchParams.get("r");
  if (r) { try { localStorage.setItem("rv_code", r); } catch (e) {} u.searchParams.delete("r"); history.replaceState(null, "", u.pathname + u.search + u.hash); }
  try { S.code = r || localStorage.getItem("rv_code") || ""; } catch (e) { S.code = r || ""; }
  if (!S.code) { $("#main").innerHTML = "<p>Open the page with your personal link.</p>"; return; }
  try { S.me = (await api("/me")).name; }
  catch (e) { $("#main").innerHTML = `<p>${esc(e.message)} Open the page with your personal link.</p>`; return; }
  $("#who").textContent = S.me;
  const [tax, batches] = await Promise.all([getJson("data/taxonomy.json"), getJson("data/batches.json")]);
  setTerms(tax.terms); S.batches = batches;
  const sel = $("#batch");
  sel.innerHTML = S.batches.map(b => `<option value="${esc(b.id)}">${esc(b.name || b.id)} (${b.n})</option>`).join("");
  try { S.batch = localStorage.getItem("rv_batch"); } catch (e) {}
  if (!S.batches.find(b => b.id === S.batch)) S.batch = (S.batches[S.batches.length - 1] || {}).id;
  sel.value = S.batch || "";
  sel.onchange = async () => { S.batch = sel.value; try { localStorage.setItem("rv_batch", S.batch); } catch (e) {} await loadBatch(true); location.hash = "#/list/todo"; route(); };
  if (!S.batch) { $("#main").innerHTML = "<p>No batch yet.</p>"; return; }
  await loadBatch(true);
  window.onhashchange = route;
  route();
}

// ---------------------------------------------------------------- data
function setTerms(all) {
  S.terms = {}; S.kids = {};
  all.forEach(t => { t.role_adaptation = t.role_a; t.role_mitigation = t.role_m; S.terms[t.id] = t; (S.kids[t.parent_id || "_" + t.facet] ||= []).push(t.id); });
  Object.values(S.kids).forEach(a => a.sort((x, y) => S.terms[x].term.localeCompare(S.terms[y].term)));
  const n = {}; all.forEach(t => n[t.facet] = (n[t.facet] || 0) + 1);
  S.facets = Object.keys(n).sort((a, b) => n[b] - n[a]);
}

async function loadBatch(withResults) {
  if (withResults) {
    const b = await getJson(`data/batch-${S.batch}.json`);
    S.list = b.results.map(r => ({ id: r.id, title: r.title, description: r.description, climate_marker: r.marker, level: r.level, type: r.type,
      ai_adaptation: r.ai_a, ai_mitigation: r.ai_m, ai_adaptation_elements: r.ai_a_el, ai_mitigation_elements: r.ai_m_el,
      ai_adaptation_pathway: r.ai_a_path, ai_mitigation_pathway: r.ai_m_path, ai_tags: r.tags }));
    S.byId = Object.fromEntries(S.list.map(r => [r.id, r]));
  }
  const st = await api(`/state?batch=${encodeURIComponent(S.batch)}`);
  S.status = st.counts || {};
  S.mine = {}; (st.mine || []).forEach(r => S.mine[r.result_id] = r);
  S.others = {}; (st.done || []).forEach(v => (S.others[v.result_id] ||= []).push(v));
}
const n2 = id => (S.status[id] || {}).submitted || 0;
async function fullResult(id) { return S.byId[id]; }

// final answer of one review: verdicts and the set of tags it keeps
function finalOf(rev, res) {
  const tags = new Set();
  (res.ai_tags || []).forEach(t => { if ((rev.tag_decisions || {})[t.concept_id] !== "disagree") tags.add(t.concept_id); });
  (rev.added_terms || []).forEach(id => tags.add(id));
  return { a: rev.adaptation_ok ? res.ai_adaptation : rev.adaptation_verdict,
           m: rev.mitigation_ok ? res.ai_mitigation : rev.mitigation_verdict, tags };
}
function reviewersAgree(id, res) {
  const v = S.others[id] || []; if (v.length < 2) return null;
  const [x, y] = v.map(r => finalOf(r, res));
  return x.a === y.a && x.m === y.m && x.tags.size === y.tags.size && [...x.tags].every(t => y.tags.has(t));
}
// agreement needs the AI tags; the list has them only after opening, so compare on stored fields
function agreeLite(id) {
  const v = S.others[id] || []; if (v.length < 2) return null;
  const k = r => JSON.stringify([r.adaptation_ok ? "ai" : r.adaptation_verdict, r.mitigation_ok ? "ai" : r.mitigation_verdict,
    Object.entries(r.tag_decisions || {}).filter(([, d]) => d === "disagree").map(([c]) => c).sort(), [...(r.added_terms || [])].sort()]);
  return k(v[0]) === k(v[1]);
}

function bucket(r) {
  const m = S.mine[r.id], n = n2(r.id);
  if (n >= 2) return agreeLite(r.id) ? "agree" : "disagree";
  if (m && m.submitted) return "waiting";
  return "todo";
}

// ---------------------------------------------------------------- routing
function route() {
  const h = location.hash.split("/");
  if (h[1] === "r" && h[2]) return openResult(decodeURIComponent(h[2]));
  S.tab = h[1] === "list" && h[2] ? h[2] : "todo";
  listView();
}

function tabs() {
  const c = { todo: 0, waiting: 0, agree: 0, disagree: 0 };
  S.list.forEach(r => c[bucket(r)]++);
  const lab = { todo: "To review", waiting: "Waiting for 2nd review", agree: "Done: agree", disagree: "Done: disagree" };
  $("#tabs").innerHTML = Object.keys(lab).map(k => `<a href="#/list/${k}" class="${S.tab === k ? "on" : ""}">${lab[k]} (${c[k]})</a>`).join("")
    + ` <a href="#" id="exp">Download file</a>`;
  $("#exp").onclick = e => { e.preventDefault(); exportFile(); };
}

function listView() {
  tabs();
  const rows = S.list.filter(r => bucket(r) === S.tab);
  const who = id => (S.others[id] || []).map(v => esc(v.reviewer)).join(", ");
  const st = r => { const m = S.mine[r.id]; return m ? (m.submitted ? "submitted" : "draft saved") : ""; };
  $("#main").innerHTML = rows.length ? `<table><tr><th>ID</th><th>Marker</th><th>AI adaptation</th><th>AI mitigation</th><th>Title</th><th>${S.tab.startsWith("d") || S.tab === "agree" ? "Reviewers" : "You"}</th></tr>
    ${rows.map(r => `<tr class="click" data-id="${esc(r.id)}"><td>${esc(r.id)}</td><td>${esc(r.climate_marker)}</td><td>${esc(r.ai_adaptation)}</td>
      <td>${esc(r.ai_mitigation)}</td><td>${esc(r.title)}</td><td class="small">${S.tab === "agree" || S.tab === "disagree" ? who(r.id) : st(r)}</td></tr>`).join("")}</table>`
    : `<p class="muted">Nothing here.</p>`;
  document.querySelectorAll("tr.click").forEach(tr => tr.onclick = () => location.hash = "#/r/" + encodeURIComponent(tr.dataset.id));
}

// ---------------------------------------------------------------- highlighting
function phrasesFor(res, added) {
  const out = [];
  const push = (s, cls, id) => { s = (s || "").trim(); if (s.length >= 3 && s.length <= 160) out.push({ s, cls, id }); };
  (res.ai_tags || []).forEach(t => {
    const cls = COUNTED.includes(t.a_counts) || COUNTED.includes(t.m_counts) ? "hc" : "hg";
    push(t.detection_excerpt, cls, t.concept_id);
    const term = S.terms[t.concept_id];
    push(t.concept_name, cls, t.concept_id);
    if (term) term.synonyms.forEach(x => push(x, cls, t.concept_id));
  });
  (added || []).forEach(id => { const t = S.terms[id]; if (t) { push(t.term, "ha", id); t.synonyms.forEach(x => push(x, "ha", id)); } });
  return out;
}
function highlight(text, phrases) {
  text = text || ""; const low = text.toLowerCase(), hits = [];
  phrases.sort((a, b) => b.s.length - a.s.length).forEach(p => {
    const q = p.s.toLowerCase(); let i = low.indexOf(q);
    while (i >= 0) {
      const before = i === 0 ? " " : low[i - 1], after = low[i + q.length] || " ";
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after) && !hits.some(h => i < h.e && i + q.length > h.b))
        hits.push({ b: i, e: i + q.length, cls: p.cls, id: p.id });
      i = low.indexOf(q, i + 1);
    }
  });
  hits.sort((a, b) => a.b - b.b);
  let html = "", at = 0;
  hits.forEach(h => {
    html += esc(text.slice(at, h.b)) + `<mark class="${h.cls}" data-id="${esc(h.id)}" title="${esc((S.terms[h.id] || {}).term || h.id)}">${esc(text.slice(h.b, h.e))}</mark>`;
    at = h.e;
  });
  return html + esc(text.slice(at));
}

// ---------------------------------------------------------------- one result
async function openResult(id) {
  tabs();
  $("#main").innerHTML = "<p>Loading…</p>";
  const res = await fullResult(id);
  if (!res) { $("#main").innerHTML = "<p>Not found.</p>"; return; }
  S.cur = res;
  if (n2(id) >= 2) return compareView(res);
  const m = S.mine[id];
  const b = v => (v === 1 || v === true ? true : v === 0 || v === false ? false : null);
  S.rev = m ? { ...JSON.parse(JSON.stringify(m)), adaptation_ok: b(m.adaptation_ok), mitigation_ok: b(m.mitigation_ok) } : { result_id: id, adaptation_ok: null, adaptation_verdict: null, mitigation_ok: null,
    mitigation_verdict: null, tag_decisions: {}, added_terms: [], proposals: [], comment: "" };
  (res.ai_tags || []).forEach(t => { if (!S.rev.tag_decisions[t.concept_id]) S.rev.tag_decisions[t.concept_id] = "agree"; });
  reviewView();
}

function navBar(res) {
  const ids = S.list.filter(r => bucket(r) === S.tab).map(r => r.id);
  const i = ids.indexOf(res.id);
  const prev = i > 0 ? ids[i - 1] : null, next = i >= 0 && i < ids.length - 1 ? ids[i + 1] : null;
  return `<div class="bar"><a href="#/list/${S.tab}">← list</a>
    <span><b>${esc(res.id)}</b> · ${esc(res.climate_marker)} · ${esc(res.level)} · ${esc(res.type)}</span>
    ${prev ? `<a href="#/r/${encodeURIComponent(prev)}">previous</a>` : ""} ${next ? `<a href="#/r/${encodeURIComponent(next)}">next</a>` : ""}</div>`;
}

function textBlock(res, added) {
  const ph = phrasesFor(res, added);
  return `<div class="text"><div class="legend small"><span style="background:#ffe066">counted</span><span style="background:#ddd">detected, not counted</span><span style="background:#a8d8ff">added by you</span></div>
    <h2>${highlight(res.title, ph.slice())}</h2><p>${highlight(res.description, ph.slice())}</p></div>`;
}

const roleOf = t => {
  const term = S.terms[t.concept_id] || {};
  const a = term.role_adaptation || (t.a_tag && t.a_tag !== "n/a" ? t.a_tag : ""), m = term.role_mitigation || (t.m_tag && t.m_tag !== "n/a" ? t.m_tag : "");
  return [a ? "A: " + a : "", m ? "M: " + m : ""].filter(Boolean).join("<br>") || "—";
};
const countOf = c => c === "specific" ? "counts" : c === "conditional_met" ? "counts (context met)" : c === "conditional_not_met" ? "not counted" : "—";

function verdictRow(axis, ai, elements, pathway) {
  const ok = S.rev[axis + "_ok"], v = S.rev[axis + "_verdict"];
  return `<div class="verdict"><b>${axis === "adaptation" ? "Adaptation" : "Mitigation"}: ${esc(ai)}</b>
    <span class="small">${esc((elements || []).join(", ") || "no element")}${pathway ? " · " + esc(pathway) : ""}</span><br>
    <label><input type="radio" name="${axis}" value="1" ${ok === true ? "checked" : ""}> agree</label>
    <label><input type="radio" name="${axis}" value="0" ${ok === false ? "checked" : ""}> disagree, should be</label>
    <select data-v="${axis}" ${ok === false ? "" : "disabled"}><option value=""></option>${VERDICTS.map(x => `<option ${v === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>`;
}

function reviewView() {
  const res = S.cur, R = S.rev;
  const tags = (res.ai_tags || []).slice().sort((a, b) =>
    (COUNTED.includes(b.a_counts) || COUNTED.includes(b.m_counts)) - (COUNTED.includes(a.a_counts) || COUNTED.includes(a.m_counts)));
  const locked = S.mine[res.id] && S.mine[res.id].submitted;
  $("#main").innerHTML = navBar(res) + (locked ? `<div class="notice">You submitted this review. You can still change it until the second reviewer submits.</div>` : "")
  + `<div class="cols">${textBlock(res, R.added_terms)}<div>
    <h3>AI verdict</h3>
    ${verdictRow("adaptation", res.ai_adaptation, res.ai_adaptation_elements, res.ai_adaptation_pathway)}
    ${verdictRow("mitigation", res.ai_mitigation, res.ai_mitigation_elements, res.ai_mitigation_pathway)}
    <h3>AI tags (${tags.length})</h3>
    <table><tr><th>Term</th><th>Facet</th><th>Role</th><th>Adaptation</th><th>Mitigation</th><th>Pathway</th><th>You</th></tr>
    ${tags.map(t => `<tr id="t-${esc(t.concept_id)}" class="${R.tag_decisions[t.concept_id] === "disagree" ? "disagree" : ""}">
      <td><a href="#" class="jump" data-id="${esc(t.concept_id)}">${esc(t.concept_name)}</a><div class="small muted">${esc(t.concept_id)}</div></td>
      <td>${esc(t.facet)}</td><td class="small">${roleOf(t)}</td><td class="small">${countOf(t.a_counts)}</td><td class="small">${countOf(t.m_counts)}</td>
      <td class="small">${esc(t.pathway_stage)}</td>
      <td class="small"><label><input type="radio" name="d-${esc(t.concept_id)}" value="agree" ${R.tag_decisions[t.concept_id] !== "disagree" ? "checked" : ""}> agree</label><br>
        <label><input type="radio" name="d-${esc(t.concept_id)}" value="disagree" ${R.tag_decisions[t.concept_id] === "disagree" ? "checked" : ""}> disagree</label></td></tr>`).join("")}
    </table>
    <h3>Terms you added</h3>
    <div id="added">${addedHtml()}</div>
    <h3>Add a term</h3>
    <input id="q" placeholder="search terms and synonyms" style="width:100%">
    <div id="hits" class="hits"></div>
    <div class="bar"><a href="#" id="brw">browse the taxonomy</a></div>
    <div id="tree" class="tree box" style="display:none"></div>
    <h3>Proposed new terms and synonyms</h3>
    <div id="props">${propsHtml()}</div>
    <h3>Comment</h3>
    <textarea id="cm">${esc(R.comment || "")}</textarea>
    <div class="bar"><button id="save">Save draft</button><button class="main" id="sub">Submit</button><span id="msg" class="small"></span></div>
  </div></div>`;
  wireReview();
}

function addedHtml() {
  const a = S.rev.added_terms || [];
  return a.length ? a.map(id => { const t = S.terms[id] || { term: id, facet: "" };
    return `<div>${esc(t.term)} <span class="small muted">${esc(id)} · ${esc(t.facet)}</span> <a href="#" class="rm" data-id="${esc(id)}">remove</a></div>`; }).join("")
    : `<p class="muted small">None.</p>`;
}
function propsHtml() {
  const p = S.rev.proposals || [];
  return p.length ? p.map((x, i) => `<div>${x.kind === "new" ? "New term" : "Synonym"}: <b>${esc(x.label)}</b>
    ${x.kind === "new" ? `<span class="small">(${esc(x.facet || "facet not set")})</span>` : `<span class="small">of ${esc((S.terms[x.of_id] || {}).term || x.of_id)}</span>`}
    ${x.note ? `<span class="small muted"> · ${esc(x.note)}</span>` : ""} <a href="#" class="rp" data-i="${i}">remove</a></div>`).join("")
    : `<p class="muted small">None.</p>`;
}

function search(q) {
  q = q.trim().toLowerCase(); if (q.length < 2) return [];
  const out = [];
  Object.values(S.terms).forEach(t => {
    const name = t.term.toLowerCase();
    let score = name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : 9, via = "";
    if (score === 9) { const s = t.synonyms.find(x => x.toLowerCase().includes(q)); if (s) { score = s.toLowerCase() === q ? 1 : 3; via = s; } }
    if (score < 9) out.push({ t, score, via });
  });
  return out.sort((a, b) => a.score - b.score || a.t.term.localeCompare(b.t.term)).slice(0, 25);
}

function wireReview() {
  const R = S.rev, res = S.cur;
  ["adaptation", "mitigation"].forEach(ax => {
    document.querySelectorAll(`input[name=${ax}]`).forEach(i => i.onchange = () => {
      R[ax + "_ok"] = i.value === "1"; const sel = $(`select[data-v=${ax}]`);
      sel.disabled = R[ax + "_ok"]; if (R[ax + "_ok"]) { sel.value = ""; R[ax + "_verdict"] = null; }
    });
    $(`select[data-v=${ax}]`).onchange = e => R[ax + "_verdict"] = e.target.value || null;
  });
  document.querySelectorAll("input[name^='d-']").forEach(i => i.onchange = () => {
    const id = i.name.slice(2); R.tag_decisions[id] = i.value;
    $("#t-" + CSS.escape(id)).classList.toggle("disagree", i.value === "disagree");
  });
  document.querySelectorAll("mark").forEach(m => m.onclick = () => {
    const row = $("#t-" + CSS.escape(m.dataset.id)); if (!row) return;
    row.scrollIntoView({ block: "center" }); row.classList.add("flash"); setTimeout(() => row.classList.remove("flash"), 900);
  });
  document.querySelectorAll("a.jump").forEach(a => a.onclick = e => {
    e.preventDefault(); const mk = document.querySelector(`mark[data-id="${CSS.escape(a.dataset.id)}"]`);
    if (mk) { mk.scrollIntoView({ block: "center" }); mk.classList.add("flash"); setTimeout(() => mk.classList.remove("flash"), 900); }
  });
  const rewireLists = () => {
    $("#added").innerHTML = addedHtml(); $("#props").innerHTML = propsHtml();
    document.querySelectorAll("a.rm").forEach(a => a.onclick = e => { e.preventDefault(); R.added_terms = R.added_terms.filter(x => x !== a.dataset.id); refreshText(); rewireLists(); });
    document.querySelectorAll("a.rp").forEach(a => a.onclick = e => { e.preventDefault(); R.proposals.splice(+a.dataset.i, 1); rewireLists(); });
  };
  const add = id => { if (!R.added_terms.includes(id) && !(res.ai_tags || []).some(t => t.concept_id === id)) { R.added_terms.push(id); refreshText(); rewireLists(); } };
  const refreshText = () => { const box = $(".text"); const y = box.scrollTop; box.outerHTML = textBlock(res, R.added_terms); $(".text").scrollTop = y;
    document.querySelectorAll("mark").forEach(m => m.onclick = () => { const row = $("#t-" + CSS.escape(m.dataset.id)); if (row) row.scrollIntoView({ block: "center" }); }); };
  rewireLists();

  const q = $("#q");
  const showHits = () => {
    const v = q.value.trim(), hits = search(v);
    $("#hits").innerHTML = hits.map(h => `<div>${esc(h.t.term)} <span class="small muted">${esc(h.t.id)} · ${esc(h.t.facet)}${h.via ? " · synonym: " + esc(h.via) : ""}</span>
      <button class="add" data-id="${esc(h.t.id)}">add</button></div>`).join("")
      + (v.length >= 2 ? `<div class="box small">${hits.length ? "Not the right one?" : "Not in the taxonomy."}
        <button id="pn">Propose "${esc(v)}" as a new term</button> <button id="ps">Propose "${esc(v)}" as a synonym</button><div id="pform"></div></div>` : "");
    document.querySelectorAll("#hits button.add").forEach(b => b.onclick = () => add(b.dataset.id));
    if ($("#pn")) $("#pn").onclick = () => propForm("new", v);
    if ($("#ps")) $("#ps").onclick = () => propForm("synonym", v);
  };
  q.oninput = showHits;
  const propForm = (kind, label) => {
    $("#pform").innerHTML = kind === "new"
      ? `<div class="bar">Facet <select id="pf"><option value=""></option>${S.facets.map(f => `<option>${esc(f)}</option>`).join("")}</select>
         Note <input id="pnote" style="flex:1" placeholder="definition or why"> <button id="pok">Add proposal</button></div>`
      : `<div class="bar">Synonym of <input id="pof" list="termlist" style="flex:1" placeholder="type a term">
         <datalist id="termlist">${Object.values(S.terms).map(t => `<option value="${esc(t.term)} [${esc(t.id)}]">`).join("")}</datalist>
         Note <input id="pnote" placeholder="optional"> <button id="pok">Add proposal</button></div>`;
    $("#pok").onclick = () => {
      const p = { kind, label, note: $("#pnote").value.trim() };
      if (kind === "new") p.facet = $("#pf").value;
      else { const m = ($("#pof").value.match(/\[([^\]]+)\]$/) || [])[1]; if (!m || !S.terms[m]) return alert("Pick a term from the list."); p.of_id = m; }
      R.proposals.push(p); q.value = ""; $("#hits").innerHTML = ""; rewireLists();
    };
  };

  $("#brw").onclick = e => { e.preventDefault(); const t = $("#tree"); t.style.display = t.style.display === "none" ? "" : "none"; if (!t.dataset.on) { t.dataset.on = 1; t.innerHTML = treeHtml(); wireTree(t, add); } };
  $("#save").onclick = () => save(false);
  $("#sub").onclick = () => save(true);
}

function treeNode(id) {
  const t = S.terms[id], kids = S.kids[id] || [];
  return `<li><span class="tog" data-id="${esc(id)}">${kids.length ? "+" : "·"}</span><a href="#" class="tdef" data-id="${esc(id)}">${esc(t.term)}</a>
    <span class="small muted">${esc(id)}</span> <button class="add" data-id="${esc(id)}">add</button><span class="def" hidden>${esc(t.definition || "")}</span><ul hidden></ul></li>`;
}
function treeHtml() {
  return `<ul>${S.facets.map(f => `<li><span class="tog" data-f="${esc(f)}">+</span><b>${esc(f)}</b> <span class="small muted">${(S.kids["_" + f] || []).length} top terms</span><ul hidden></ul></li>`).join("")}</ul>`;
}
function wireTree(root, add) {
  root.onclick = e => {
    const el = e.target;
    if (el.classList.contains("tog")) {
      const ul = el.parentNode.querySelector(":scope > ul"); const ids = el.dataset.f ? (S.kids["_" + el.dataset.f] || []) : (S.kids[el.dataset.id] || []);
      if (!ids.length) return;
      if (!ul.dataset.on) { ul.dataset.on = 1; ul.innerHTML = ids.map(treeNode).join(""); }
      ul.hidden = !ul.hidden; el.textContent = ul.hidden ? "+" : "−";
    } else if (el.classList.contains("tdef")) {
      e.preventDefault(); const d = el.parentNode.querySelector(":scope > .def"); d.hidden = !d.hidden;
    } else if (el.classList.contains("add")) add(el.dataset.id);
  };
}

async function save(submit) {
  const R = S.rev, msg = $("#msg");
  R.comment = $("#cm").value;
  if (submit) {
    for (const ax of ["adaptation", "mitigation"]) {
      if (R[ax + "_ok"] === null || R[ax + "_ok"] === undefined) return msg.textContent = `Say whether you agree with the ${ax} verdict.`;
      if (R[ax + "_ok"] === false && !R[ax + "_verdict"]) return msg.textContent = `Choose the ${ax} verdict it should be.`;
    }
  }
  const row = { result_id: R.result_id, batch_id: S.batch, submitted: submit || !!(S.mine[R.result_id] || {}).submitted,
    adaptation_ok: R.adaptation_ok, adaptation_verdict: R.adaptation_verdict, mitigation_ok: R.mitigation_ok, mitigation_verdict: R.mitigation_verdict,
    tag_decisions: R.tag_decisions, added_terms: R.added_terms, proposals: R.proposals, comment: R.comment };
  try { S.mine[R.result_id] = await api("/review", { method: "PUT", body: JSON.stringify(row) }); }
  catch (e) { return msg.textContent = e.message; }
  await loadBatch(false);
  if (!submit) { msg.textContent = "Saved."; tabs(); return; }
  const next = S.list.find(r => bucket(r) === "todo" && r.id !== R.result_id);
  location.hash = next ? "#/r/" + encodeURIComponent(next.id) : "#/list/todo";
}

// ---------------------------------------------------------------- both reviews side by side
function compareView(res) {
  const v = (S.others[res.id] || []).slice(0, 2);
  const nm = r => esc(r.reviewer);
  const vd = (r, ax) => r[ax + "_ok"] ? "agree" : esc(r[ax + "_verdict"] || "—");
  const same = (a, b) => a === b ? "ok" : "diff";
  const agree = reviewersAgree(res.id, res);
  const addedAll = [...new Set(v.flatMap(r => r.added_terms || []))];
  const tg = (r, id) => ((r.tag_decisions || {})[id] === "disagree" ? "disagree" : "agree");
  $("#main").innerHTML = navBar(res) + `<div class="notice">${agree ? "The two reviewers agree." : "The two reviewers disagree. Differences are marked."}</div>
  <div class="cols">${textBlock(res, addedAll)}<div>
    <table><tr><th></th><th>AI</th><th>${nm(v[0])}</th><th>${nm(v[1])}</th></tr>
    ${["adaptation", "mitigation"].map(ax => { const a = vd(v[0], ax), b = vd(v[1], ax);
      return `<tr><th>${ax === "adaptation" ? "Adaptation" : "Mitigation"}</th><td>${esc(res["ai_" + ax])}</td><td class="${same(a, b)}">${a}</td><td class="${same(a, b)}">${b}</td></tr>`; }).join("")}
    <tr><th colspan="4">AI tags</th></tr>
    ${(res.ai_tags || []).map(t => { const a = tg(v[0], t.concept_id), b = tg(v[1], t.concept_id);
      return `<tr><td>${esc(t.concept_name)} <span class="small muted">${esc(t.facet)}</span></td><td class="small">${countOf(t.a_counts)} / ${countOf(t.m_counts)}</td>
        <td class="${same(a, b)}">${a}</td><td class="${same(a, b)}">${b}</td></tr>`; }).join("")}
    <tr><th colspan="4">Added terms</th></tr>
    ${addedAll.length ? addedAll.map(id => { const a = (v[0].added_terms || []).includes(id) ? "added" : "", b = (v[1].added_terms || []).includes(id) ? "added" : "";
      return `<tr><td>${esc((S.terms[id] || {}).term || id)}</td><td></td><td class="${same(a, b)}">${a}</td><td class="${same(a, b)}">${b}</td></tr>`; }).join("") : `<tr><td colspan="4" class="muted">None.</td></tr>`}
    <tr><th>Proposals</th><td></td>${v.map(r => `<td class="small">${(r.proposals || []).map(p => `${p.kind === "new" ? "new" : "synonym"}: ${esc(p.label)}${p.of_id ? " → " + esc((S.terms[p.of_id] || {}).term || p.of_id) : ""}`).join("<br>") || "—"}</td>`).join("")}</tr>
    <tr><th>Comment</th><td></td>${v.map(r => `<td class="small">${esc(r.comment || "—")}</td>`).join("")}</tr>
    </table></div></div>`;
}

// ---------------------------------------------------------------- export: one file, one row per PRMS result
async function exportFile() {
  let revs;
  try { revs = await api(`/export?batch=${encodeURIComponent(S.batch)}`); } catch (e) { return alert(e.message); }
  const by = {}; revs.forEach(r => (by[r.result_id] ||= []).push(r));
  const tname = id => (S.terms[id] || {}).term || id;
  const counted = t => COUNTED.includes(t.a_counts) || COUNTED.includes(t.m_counts);
  const verdict = (r, ax) => r[ax + "_ok"] === 1 || r[ax + "_ok"] === true ? "agree" : r[ax + "_ok"] === 0 || r[ax + "_ok"] === false ? "should be " + (r[ax + "_verdict"] || "?") : "";
  const one = (r, res) => r ? [r.reviewer, r.submitted ? "submitted" : "draft", verdict(r, "adaptation"), verdict(r, "mitigation"),
    Object.entries(r.tag_decisions || {}).filter(([, d]) => d === "disagree").map(([c]) => tname(c)).join("; "),
    (r.added_terms || []).map(tname).join("; "),
    (r.proposals || []).map(p => p.kind === "new" ? `new term: ${p.label}${p.facet ? " (" + p.facet + ")" : ""}` : `synonym: ${p.label} -> ${tname(p.of_id)}`).join("; "),
    r.comment || "", r.updated_at || ""] : ["", "", "", "", "", "", "", "", ""];
  const RV = ["reviewer", "status", "adaptation decision", "mitigation decision", "AI tags rejected", "terms added", "proposed new terms / synonyms", "comment", "date"];
  const head = ["result_id", "climate_marker", "level", "type", "title", "description", "AI adaptation", "AI mitigation", "AI counted terms", "AI terms not counted",
    "review status", "reviewers agree", ...RV.map(c => "R1 " + c), ...RV.map(c => "R2 " + c)];
  const rows = S.list.map(res => {
    const v = (by[res.id] || []).slice(0, 2), sub = v.filter(r => r.submitted).length;
    const agree = sub >= 2 ? (reviewersAgree(res.id, res) === null ? "" : (agreeLite(res.id) ? "yes" : "no")) : "";
    return [res.id, res.climate_marker, res.level, res.type, res.title, res.description, res.ai_adaptation, res.ai_mitigation,
      (res.ai_tags || []).filter(counted).map(t => t.concept_name).join("; "), (res.ai_tags || []).filter(t => !counted(t)).map(t => t.concept_name).join("; "),
      sub >= 2 ? "2 reviews" : sub === 1 ? "1 review" : v.length ? "in progress" : "not reviewed", agree, ...one(v[0], res), ...one(v[1], res)];
  });
  const readme = [["Tagging review: " + S.batch], [],
    ["One row per PRMS result. R1 and R2 are the two reviewers. Use the filters on the 'reviews' sheet."],
    ["adaptation / mitigation decision", "agree = agrees with the AI verdict; should be X = the reviewer's verdict"],
    ["AI tags rejected", "AI tags the reviewer disagreed with"],
    ["terms added", "taxonomy terms the reviewer added"],
    ["proposed new terms / synonyms", "terms not in the taxonomy, proposed as new terms or as synonyms of an existing term"],
    ["review status", "not reviewed, in progress, 1 review, 2 reviews"],
    ["reviewers agree", "yes when both reviewers end with the same verdicts and the same tags"],
    ["blind rule", "you see another reviewer's answers only once both reviews of that result are submitted"],
    ["downloaded", new Date().toISOString().slice(0, 16).replace("T", " ") + " by " + S.me]];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: head.length - 1 } }) };
  ws["!cols"] = head.map(h => ({ wch: /title|description|comment|terms|tags|proposed/.test(h) ? 40 : 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "reviews");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(readme), "read me");
  XLSX.writeFile(wb, `review_${S.batch}.xlsx`);
}

boot();
