// Tagging review. Plain JS, no build step. The taxonomy and the results are static files in data/;
// the reviews are stored by a small worker (worker/), which knows the reviewer from their personal link (?r=code).
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const VERDICTS = ["Full", "Partial", "Minimal", "None"];
const COUNTED = ["specific", "conditional_met"];
const isCounted = t => COUNTED.includes(t.a_counts) || COUNTED.includes(t.m_counts);

const S = {
  code: "", me: "", batch: null, batches: [],
  terms: {}, kids: {}, facets: [], termList: [], termsReady: null,
  list: [], byId: {}, status: {}, mine: {}, others: {},   // others: both reviews of finished results, by result id
  tab: "todo", cur: null, rev: null,
};

// ---------------------------------------------------------------- network
// GET with the code in the URL and POST as text/plain: both count as "simple" requests, so the browser
// does not send a permission check before each call.
async function api(path, body) {
  const url = CONFIG.api + path + (path.includes("?") ? "&" : "?") + "r=" + encodeURIComponent(S.code);
  const r = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) } : {});
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || r.statusText);
  return out;
}
const getJson = async (p, fresh) => { const r = await fetch(p, fresh ? { cache: "no-cache" } : {}); if (!r.ok) throw new Error(p + ": " + r.status); return r.json(); };
const pageMsg = html => $("#main").innerHTML = `<div class="empty">${html}</div>`;

// ---------------------------------------------------------------- start
async function boot() {
  const u = new URL(location.href), r = u.searchParams.get("r");
  if (r) { try { localStorage.setItem("rv_code", r); } catch (e) {} u.searchParams.delete("r"); history.replaceState(null, "", u.pathname + u.search + u.hash); }
  try { S.code = r || localStorage.getItem("rv_code") || ""; } catch (e) { S.code = r || ""; }
  if (!S.code) return pageMsg("Open this page with your personal link.");
  pageMsg("Loading…");

  S.batches = await getJson("data/batches.json", true);                     // tiny, always fresh
  let saved = null; try { saved = localStorage.getItem("rv_batch"); } catch (e) {}
  S.batch = (S.batches.find(b => b.id === saved) || S.batches[S.batches.length - 1] || {}).id;
  if (!S.batch) return pageMsg("No batch yet.");
  const B = S.batches.find(b => b.id === S.batch);
  S.termsReady = getJson(`data/taxonomy.json?v=${B.tv || ""}`).then(t => setTerms(t.terms));   // in the background
  try { await loadBatch(true); }
  catch (e) { return pageMsg(esc(e.message) + "<br>Open this page with your personal link."); }

  $("#who").textContent = S.me;
  const sel = $("#batch");
  sel.innerHTML = S.batches.map(b => `<option value="${esc(b.id)}">${esc(b.name || b.id)} · ${b.n}</option>`).join("");
  sel.value = S.batch;
  sel.onchange = async () => { S.batch = sel.value; try { localStorage.setItem("rv_batch", S.batch); } catch (e) {} pageMsg("Loading…"); await loadBatch(true); location.hash = "#/list/todo"; route(); };
  window.onhashchange = route;
  route();
}

function setTerms(all) {
  S.terms = {}; S.kids = {};
  all.forEach(t => { S.terms[t.id] = t; (S.kids[t.parent_id || "_" + t.facet] ||= []).push(t.id); });
  Object.values(S.kids).forEach(a => a.sort((x, y) => S.terms[x].term.localeCompare(S.terms[y].term)));
  const n = {}; all.forEach(t => n[t.facet] = (n[t.facet] || 0) + 1);
  S.facets = Object.keys(n).sort((a, b) => n[b] - n[a]);
  S.termList = all.map(t => ({ t, name: t.term.toLowerCase(), syn: t.synonyms.map(x => x.toLowerCase()) }));
}

async function loadBatch(withResults) {
  const B = S.batches.find(b => b.id === S.batch) || {};
  const [b, st] = await Promise.all([
    withResults ? getJson(`data/batch-${S.batch}.json?v=${B.v || ""}`) : null,
    api(`/state?batch=${encodeURIComponent(S.batch)}`)]);
  if (b) { S.list = b.results; S.byId = Object.fromEntries(S.list.map(r => [r.id, r])); }
  S.me = st.name || S.me;
  setState(st);
}
function setState(st) {
  S.status = st.counts || {};
  S.mine = {}; (st.mine || []).forEach(r => S.mine[r.result_id] = r);
  S.others = {}; (st.done || []).forEach(v => (S.others[v.result_id] ||= []).push(v));
}
const refreshState = () => api(`/state?batch=${encodeURIComponent(S.batch)}`).then(st => { setState(st); tabs(); }).catch(() => {});
const n2 = id => (S.status[id] || {}).submitted || 0;

// ---------------------------------------------------------------- agreement
const yes = v => v === 1 || v === true, no = v => v === 0 || v === false;
function finalOf(rev, res) {
  const tags = new Set();
  (res.tags || []).forEach(t => { if ((rev.tag_decisions || {})[t.concept_id] !== "disagree") tags.add(t.concept_id); });
  (rev.added_terms || []).forEach(id => tags.add(id));
  return { a: yes(rev.adaptation_ok) ? res.ai_a : rev.adaptation_verdict, m: yes(rev.mitigation_ok) ? res.ai_m : rev.mitigation_verdict, tags };
}
function reviewersAgree(id) {
  const v = S.others[id] || [], res = S.byId[id]; if (v.length < 2 || !res) return null;
  const [x, y] = v.map(r => finalOf(r, res));
  return x.a === y.a && x.m === y.m && x.tags.size === y.tags.size && [...x.tags].every(t => y.tags.has(t));
}
function bucket(r) {
  const m = S.mine[r.id], n = n2(r.id);
  if (n >= 2) return reviewersAgree(r.id) ? "agree" : "disagree";
  if (m && m.submitted) return "waiting";
  return "todo";
}

// ---------------------------------------------------------------- list
function route() {
  const h = location.hash.split("/");
  if (h[1] === "r" && h[2]) return openResult(decodeURIComponent(h[2]));
  S.tab = h[1] === "list" && h[2] ? h[2] : "todo";
  listView();
}

const TABS = { todo: "To review", waiting: "Waiting for 2nd review", agree: "Done · agree", disagree: "Done · disagree" };
function tabs() {
  const c = { todo: 0, waiting: 0, agree: 0, disagree: 0 };
  S.list.forEach(r => c[bucket(r)]++);
  $("#tabs").innerHTML = Object.keys(TABS).map(k => `<a href="#/list/${k}" class="tab ${S.tab === k ? "on" : ""}">${TABS[k]}<span class="n">${c[k]}</span></a>`).join("")
    + `<a href="#" id="exp" class="tab dl">Download file</a>`;
  $("#exp").onclick = e => { e.preventDefault(); exportFile(); };
}

const pill = v => `<span class="pill v-${esc(String(v || "").toLowerCase())}">${esc(v || "—")}</span>`;
function listView() {
  tabs();
  const rows = S.list.filter(r => bucket(r) === S.tab);
  const done = S.tab === "agree" || S.tab === "disagree";
  const who = id => (S.others[id] || []).map(v => esc(v.reviewer)).join(", ");
  const you = r => { const m = S.mine[r.id]; return m ? (m.submitted ? "submitted" : "draft") : ""; };
  $("#main").innerHTML = rows.length ? `<div class="card flush"><table class="list">
    <thead><tr><th>ID</th><th>Marker</th><th>Adaptation</th><th>Mitigation</th><th>Title</th><th>${done ? "Reviewers" : "You"}</th></tr></thead><tbody>
    ${rows.map(r => `<tr data-id="${esc(r.id)}"><td class="mono">${esc(r.id)}</td><td class="nowrap">${esc(r.marker)}</td><td>${pill(r.ai_a)}</td><td>${pill(r.ai_m)}</td>
      <td>${esc(r.title)}</td><td class="muted small nowrap">${done ? who(r.id) : you(r)}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">Nothing here.</div>`;
  $$("tr[data-id]").forEach(tr => tr.onclick = () => location.hash = "#/r/" + encodeURIComponent(tr.dataset.id));
}

// ---------------------------------------------------------------- highlighting
function phrasesFor(res, added) {
  const out = [], push = (s, cls, id) => { s = (s || "").trim(); if (s.length >= 3 && s.length <= 160) out.push({ s, cls, id }); };
  (res.tags || []).forEach(t => {
    const cls = isCounted(t) ? "hc" : "hg";
    push(t.detection_excerpt, cls, t.concept_id); push(t.concept_name, cls, t.concept_id);
    (S.terms[t.concept_id] || { synonyms: [] }).synonyms.forEach(x => push(x, cls, t.concept_id));
  });
  (added || []).forEach(id => { const t = S.terms[id]; if (t) { push(t.term, "ha", id); t.synonyms.forEach(x => push(x, "ha", id)); } });
  return out.sort((a, b) => b.s.length - a.s.length);
}
function highlight(text, phrases) {
  text = text || ""; const low = text.toLowerCase(), hits = [];
  phrases.forEach(p => {
    const q = p.s.toLowerCase(); let i = low.indexOf(q);
    while (i >= 0) {
      const before = i === 0 ? " " : low[i - 1], after = low[i + q.length] || " ";
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after) && !hits.some(h => i < h.e && i + q.length > h.b)) hits.push({ b: i, e: i + q.length, cls: p.cls, id: p.id });
      i = low.indexOf(q, i + 1);
    }
  });
  hits.sort((a, b) => a.b - b.b);
  let html = "", at = 0;
  hits.forEach(h => { html += esc(text.slice(at, h.b)) + `<mark class="${h.cls}" data-id="${esc(h.id)}" title="${esc((S.terms[h.id] || {}).term || h.id)}">${esc(text.slice(h.b, h.e))}</mark>`; at = h.e; });
  return html + esc(text.slice(at));
}
function textBlock(res, added) {
  const ph = phrasesFor(res, added);
  return `<div class="text card"><div class="legend"><span class="k hc">counted</span><span class="k hg">detected, not counted</span><span class="k ha">added by you</span></div>
    <h2>${highlight(res.title, ph)}</h2><p>${highlight(res.description, ph)}</p></div>`;
}
const flash = el => { if (!el) return; el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1000); };
function wireMarks() { $$("mark").forEach(m => m.onclick = () => flash($("#t-" + CSS.escape(m.dataset.id)))); }

// ---------------------------------------------------------------- one result
async function openResult(id) {
  tabs();
  const res = S.byId[id];
  if (!res) return pageMsg("Not found.");
  if (!S.termList.length) { pageMsg("Loading the taxonomy…"); await S.termsReady; }
  S.cur = res;
  if (n2(id) >= 2) return compareView(res);
  const m = S.mine[id], b = v => (yes(v) ? true : no(v) ? false : null);
  S.rev = m ? { ...JSON.parse(JSON.stringify(m)), adaptation_ok: b(m.adaptation_ok), mitigation_ok: b(m.mitigation_ok) }
    : { result_id: id, adaptation_ok: null, adaptation_verdict: null, mitigation_ok: null, mitigation_verdict: null, tag_decisions: {}, added_terms: [], proposals: [], comment: "" };
  (res.tags || []).forEach(t => { if (!S.rev.tag_decisions[t.concept_id]) S.rev.tag_decisions[t.concept_id] = "agree"; });
  reviewView();
  window.scrollTo(0, 0);
}

function navBar(res) {
  const ids = S.list.filter(r => bucket(r) === S.tab).map(r => r.id), i = ids.indexOf(res.id);
  const prev = i > 0 ? ids[i - 1] : null, next = i >= 0 && i < ids.length - 1 ? ids[i + 1] : null;
  return `<div class="nav"><a href="#/list/${S.tab}" class="back">← ${TABS[S.tab] || "list"}</a>
    <span class="meta"><b class="mono">${esc(res.id)}</b><span>${esc(res.marker)}</span><span>${esc(res.level)}</span><span>${esc(res.type)}</span></span>
    <span class="pager">${prev ? `<a href="#/r/${encodeURIComponent(prev)}">‹ previous</a>` : ""}${i >= 0 ? `<span class="muted">${i + 1} / ${ids.length}</span>` : ""}${next ? `<a href="#/r/${encodeURIComponent(next)}">next ›</a>` : ""}</span></div>`;
}

const roleOf = t => { const term = S.terms[t.concept_id] || {}; return [term.role_a ? "A " + term.role_a : "", term.role_m ? "M " + term.role_m : ""].filter(Boolean).join("<br>") || "—"; };
const countOf = c => c === "specific" ? `<span class="c-yes">counts</span>` : c === "conditional_met" ? `<span class="c-yes">counts</span> <span class="muted">context met</span>`
  : c === "conditional_not_met" ? `<span class="c-no">not counted</span>` : `<span class="muted">—</span>`;
const seg = (name, value, label, on, cls = "") => `<label class="seg ${cls}"><input type="radio" name="${esc(name)}" value="${value}" ${on ? "checked" : ""}><span>${label}</span></label>`;

function verdictRow(axis, ai, elements, pathway) {
  const ok = S.rev[axis + "_ok"], v = S.rev[axis + "_verdict"];
  return `<div class="verdict"><div class="vh"><span class="ax">${axis === "adaptation" ? "Adaptation" : "Mitigation"}</span>${pill(ai)}
      <span class="muted small">${esc([].concat(elements || []).join(", ") || "no element")}</span></div>
    ${pathway ? `<div class="path small">${esc(pathway)}</div>` : ""}
    <div class="decide"><span class="segs">${seg(axis, 1, "Agree", ok === true, "ok")}${seg(axis, 0, "Disagree", ok === false, "ko")}</span>
      <select data-v="${axis}" ${ok === false ? "" : "hidden"}><option value="">should be…</option>${VERDICTS.map(x => `<option ${v === x ? "selected" : ""}>${x}</option>`).join("")}</select></div></div>`;
}

function reviewView() {
  const res = S.cur, R = S.rev;
  const tags = (res.tags || []).slice().sort((a, b) => isCounted(b) - isCounted(a));
  const submitted = S.mine[res.id] && S.mine[res.id].submitted;
  $("#main").innerHTML = navBar(res) + (submitted ? `<div class="notice">Submitted. You can still change it until the second reviewer submits.</div>` : "")
  + `<div class="cols">${textBlock(res, R.added_terms)}<div class="side">
    <section class="card"><h3>AI verdict</h3>
      ${verdictRow("adaptation", res.ai_a, res.ai_a_el, res.ai_a_path)}
      ${verdictRow("mitigation", res.ai_m, res.ai_m_el, res.ai_m_path)}</section>
    <section class="card flush"><h3 class="pad">AI tags <span class="muted">${tags.length}</span></h3>
      <table class="tags"><thead><tr><th>Term</th><th>Facet</th><th>Role</th><th>Adaptation</th><th>Mitigation</th><th>Pathway</th><th></th></tr></thead><tbody>
      ${tags.map(t => { const d = R.tag_decisions[t.concept_id] === "disagree";
        return `<tr id="t-${esc(t.concept_id)}" class="${d ? "disagree" : ""} ${isCounted(t) ? "" : "grey"}">
        <td><a href="#" class="jump" data-id="${esc(t.concept_id)}">${esc(t.concept_name)}</a><div class="mono muted">${esc(t.concept_id)}</div></td>
        <td>${esc(t.facet)}</td><td class="small">${roleOf(t)}</td><td class="small">${countOf(t.a_counts)}</td><td class="small">${countOf(t.m_counts)}</td>
        <td class="small">${esc(t.pathway_stage)}</td>
        <td class="nowrap"><span class="segs sm">${seg("d-" + t.concept_id, "agree", "✓", !d, "ok")}${seg("d-" + t.concept_id, "disagree", "✗", d, "ko")}</span></td></tr>`; }).join("")}
      </tbody></table></section>
    <section class="card"><h3>Add a term</h3>
      <input id="q" class="search" placeholder="Search terms and synonyms" autocomplete="off">
      <div id="hits" class="hits"></div>
      <div id="added" class="chips"></div>
      <a href="#" id="brw" class="small">Browse the taxonomy</a>
      <div id="tree" class="tree" hidden></div></section>
    <section class="card"><h3>Proposed new terms and synonyms</h3><div id="props" class="chips"></div></section>
    <section class="card"><h3>Comment</h3><textarea id="cm" placeholder="Anything the others should know">${esc(R.comment || "")}</textarea></section>
    <div class="actions"><span id="msg" class="small"></span><button id="save">Save draft</button><button class="primary" id="sub">Submit</button></div>
  </div></div>`;
  wireReview();
}

function addedHtml() {
  return (S.rev.added_terms || []).map(id => { const t = S.terms[id] || { term: id, facet: "" };
    return `<span class="chip add">${esc(t.term)} <small>${esc(t.facet)}</small><a href="#" class="rm" data-id="${esc(id)}" title="remove">×</a></span>`; }).join("");
}
function propsHtml() {
  const p = S.rev.proposals || [];
  return p.length ? p.map((x, i) => `<span class="chip prop">${x.kind === "new" ? "new" : "synonym"} · <b>${esc(x.label)}</b>
    <small>${x.kind === "new" ? esc(x.facet || "") : "of " + esc((S.terms[x.of_id] || {}).term || x.of_id)}${x.note ? " · " + esc(x.note) : ""}</small><a href="#" class="rp" data-i="${i}" title="remove">×</a></span>`).join("")
    : `<span class="muted small">None. Search for a term; if it is not in the taxonomy you can propose it.</span>`;
}

function search(q) {
  q = q.trim().toLowerCase(); if (q.length < 2) return [];
  const out = [];
  for (const x of S.termList) {
    let score = x.name === q ? 0 : x.name.startsWith(q) ? 1 : x.name.includes(q) ? 2 : 9, via = "";
    if (score === 9) { const i = x.syn.findIndex(s => s.includes(q)); if (i >= 0) { score = x.syn[i] === q ? 1 : 3; via = x.t.synonyms[i]; } }
    if (score < 9) out.push({ t: x.t, score, via });
  }
  return out.sort((a, b) => a.score - b.score || a.t.term.localeCompare(b.t.term)).slice(0, 12);
}

function wireReview() {
  const R = S.rev, res = S.cur;
  ["adaptation", "mitigation"].forEach(ax => {
    $$(`input[name=${ax}]`).forEach(i => i.onchange = () => {
      R[ax + "_ok"] = i.value === "1"; const sel = $(`select[data-v=${ax}]`);
      sel.hidden = R[ax + "_ok"]; if (R[ax + "_ok"]) { sel.value = ""; R[ax + "_verdict"] = null; } else sel.focus();
    });
    $(`select[data-v=${ax}]`).onchange = e => R[ax + "_verdict"] = e.target.value || null;
  });
  $$("input[name^='d-']").forEach(i => i.onchange = () => {
    const id = i.name.slice(2); R.tag_decisions[id] = i.value;
    $("#t-" + CSS.escape(id)).classList.toggle("disagree", i.value === "disagree");
  });
  wireMarks();
  $$("a.jump").forEach(a => a.onclick = e => { e.preventDefault(); flash($(`mark[data-id="${CSS.escape(a.dataset.id)}"]`)); });

  const refreshText = () => { const box = $(".text"), y = box.scrollTop; box.outerHTML = textBlock(res, R.added_terms); $(".text").scrollTop = y; wireMarks(); };
  const lists = () => {
    $("#added").innerHTML = addedHtml(); $("#props").innerHTML = propsHtml();
    $$("a.rm").forEach(a => a.onclick = e => { e.preventDefault(); R.added_terms = R.added_terms.filter(x => x !== a.dataset.id); refreshText(); lists(); });
    $$("a.rp").forEach(a => a.onclick = e => { e.preventDefault(); R.proposals.splice(+a.dataset.i, 1); lists(); });
  };
  const add = id => { if (!R.added_terms.includes(id) && !(res.tags || []).some(t => t.concept_id === id)) { R.added_terms.push(id); refreshText(); lists(); } };
  lists();

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
  const propForm = (kind, label) => {
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
      const p = { kind, label, note: $("#pnote").value.trim() };
      if (kind === "new") p.facet = $("#pf").value;
      else { if (!of) { $("#pof").focus(); $("#pof").classList.add("bad"); return; } p.of_id = of; }
      R.proposals.push(p); q.value = ""; $("#hits").innerHTML = ""; lists();
    };
  };

  $("#brw").onclick = e => { e.preventDefault(); const t = $("#tree"); t.hidden = !t.hidden; if (!t.dataset.on) { t.dataset.on = 1; t.innerHTML = treeHtml(); wireTree(t, add); } };
  $("#save").onclick = () => save(false);
  $("#sub").onclick = () => save(true);
}

function treeNode(id) {
  const t = S.terms[id], kids = S.kids[id] || [];
  return `<li><span class="tog ${kids.length ? "" : "leaf"}" data-id="${esc(id)}">${kids.length ? "▸" : "·"}</span><a href="#" class="tdef" data-id="${esc(id)}">${esc(t.term)}</a>
    ${kids.length ? `<span class="muted small">${kids.length}</span>` : ""}<button class="add sm" data-id="${esc(id)}">+ add</button>
    <div class="def" hidden>${esc(t.definition || "No definition.")}</div><ul hidden></ul></li>`;
}
function treeHtml() {
  return `<ul>${S.facets.map(f => `<li><span class="tog" data-f="${esc(f)}">▸</span><b>${esc(f)}</b> <span class="muted small">${(S.kids["_" + f] || []).length}</span><ul hidden></ul></li>`).join("")}</ul>`;
}
function wireTree(root, add) {
  root.onclick = e => {
    const el = e.target;
    if (el.classList.contains("tog")) {
      const ul = el.parentNode.querySelector(":scope > ul"), ids = el.dataset.f ? (S.kids["_" + el.dataset.f] || []) : (S.kids[el.dataset.id] || []);
      if (!ids.length) return;
      if (!ul.dataset.on) { ul.dataset.on = 1; ul.innerHTML = ids.map(treeNode).join(""); }
      ul.hidden = !ul.hidden; el.textContent = ul.hidden ? "▸" : "▾";
    } else if (el.classList.contains("tdef")) { e.preventDefault(); const d = el.parentNode.querySelector(":scope > .def"); d.hidden = !d.hidden; }
    else if (el.classList.contains("add")) { add(el.dataset.id); el.textContent = "added"; el.disabled = true; }
  };
}

async function save(submit) {
  const R = S.rev, msg = $("#msg");
  R.comment = $("#cm").value;
  if (submit) for (const ax of ["adaptation", "mitigation"]) {
    if (R[ax + "_ok"] === null || R[ax + "_ok"] === undefined) { msg.textContent = `Agree or disagree with the ${ax} verdict first.`; msg.className = "small bad"; return; }
    if (R[ax + "_ok"] === false && !R[ax + "_verdict"]) { msg.textContent = `Choose what the ${ax} verdict should be.`; msg.className = "small bad"; return; }
  }
  const was = S.mine[R.result_id], row = { result_id: R.result_id, batch_id: S.batch, submitted: submit || !!(was && was.submitted),
    adaptation_ok: R.adaptation_ok, adaptation_verdict: R.adaptation_verdict, mitigation_ok: R.mitigation_ok, mitigation_verdict: R.mitigation_verdict,
    tag_decisions: R.tag_decisions, added_terms: R.added_terms, proposals: R.proposals, comment: R.comment };
  msg.className = "small"; msg.textContent = "Saving…"; $("#save").disabled = $("#sub").disabled = true;
  let saved;
  try { saved = await api("/review", row); }
  catch (e) { msg.textContent = e.message; msg.className = "small bad"; $("#save").disabled = $("#sub").disabled = false; return; }
  S.mine[R.result_id] = saved;
  const c = S.status[R.result_id] ||= { started: 0, submitted: 0 };       // update counts here; the full refresh runs in the background
  if (!was) c.started++;
  if (row.submitted && !(was && was.submitted)) c.submitted++;
  refreshState();
  if (!submit) { msg.textContent = "Saved."; $("#save").disabled = $("#sub").disabled = false; tabs(); return; }
  const next = S.list.find(r => bucket(r) === "todo" && r.id !== R.result_id);
  location.hash = next ? "#/r/" + encodeURIComponent(next.id) : "#/list/todo";
}

// ---------------------------------------------------------------- both reviews side by side
function compareView(res) {
  const v = (S.others[res.id] || []).slice(0, 2);
  const vd = (r, ax) => yes(r[ax + "_ok"]) ? "agree" : esc(r[ax + "_verdict"] || "—");
  const cell = (a, b) => a === b ? "same" : "diff";
  const agree = reviewersAgree(res.id);
  const addedAll = [...new Set(v.flatMap(r => r.added_terms || []))];
  const tg = (r, id) => ((r.tag_decisions || {})[id] === "disagree" ? "✗ disagree" : "✓ agree");
  $("#main").innerHTML = navBar(res) + `<div class="notice ${agree ? "good" : ""}">${agree ? "The two reviewers agree." : "The two reviewers disagree. Differences are marked in red."}</div>
  <div class="cols">${textBlock(res, addedAll)}<div class="side"><section class="card flush">
    <table class="cmp"><thead><tr><th></th><th>AI</th><th>${esc(v[0].reviewer)}</th><th>${esc(v[1].reviewer)}</th></tr></thead><tbody>
    ${["adaptation", "mitigation"].map(ax => { const a = vd(v[0], ax), b = vd(v[1], ax);
      return `<tr><th>${ax === "adaptation" ? "Adaptation" : "Mitigation"}</th><td>${pill(res["ai_" + ax[0]])}</td><td class="${cell(a, b)}">${a}</td><td class="${cell(a, b)}">${b}</td></tr>`; }).join("")}
    <tr class="sec"><th colspan="4">AI tags</th></tr>
    ${(res.tags || []).map(t => { const a = tg(v[0], t.concept_id), b = tg(v[1], t.concept_id);
      return `<tr><td>${esc(t.concept_name)} <span class="muted small">${esc(t.facet)}</span></td><td class="small">${isCounted(t) ? "counts" : "not counted"}</td>
        <td class="${cell(a, b)}">${a}</td><td class="${cell(a, b)}">${b}</td></tr>`; }).join("")}
    <tr class="sec"><th colspan="4">Added terms</th></tr>
    ${addedAll.length ? addedAll.map(id => { const a = (v[0].added_terms || []).includes(id) ? "added" : "", b = (v[1].added_terms || []).includes(id) ? "added" : "";
      return `<tr><td>${esc((S.terms[id] || {}).term || id)}</td><td></td><td class="${cell(a, b)}">${a}</td><td class="${cell(a, b)}">${b}</td></tr>`; }).join("") : `<tr><td colspan="4" class="muted">None.</td></tr>`}
    <tr class="sec"><th colspan="4">Proposals and comments</th></tr>
    <tr><th>Proposals</th><td></td>${v.map(r => `<td class="small">${(r.proposals || []).map(p => `${p.kind === "new" ? "new" : "synonym"}: ${esc(p.label)}${p.of_id ? " → " + esc((S.terms[p.of_id] || {}).term || p.of_id) : ""}`).join("<br>") || "—"}</td>`).join("")}</tr>
    <tr><th>Comment</th><td></td>${v.map(r => `<td class="small">${esc(r.comment || "—")}</td>`).join("")}</tr>
    </tbody></table></section></div></div>`;
  wireMarks();
}

// ---------------------------------------------------------------- the file: one row per PRMS result
function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
}
async function exportFile() {
  const link = $("#exp"), label = link.textContent; link.textContent = "Preparing…";
  let revs;
  try { [revs] = await Promise.all([api(`/export?batch=${encodeURIComponent(S.batch)}`), loadXlsx(), S.termsReady]); }
  catch (e) { link.textContent = label; return alert(e.message); }
  const by = {}; revs.forEach(r => (by[r.result_id] ||= []).push(r));
  const tname = id => (S.terms[id] || {}).term || id;
  const verdict = (r, ax) => yes(r[ax + "_ok"]) ? "agree" : no(r[ax + "_ok"]) ? "should be " + (r[ax + "_verdict"] || "?") : "";
  const one = r => r ? [r.reviewer, r.submitted ? "submitted" : "draft", verdict(r, "adaptation"), verdict(r, "mitigation"),
    Object.entries(r.tag_decisions || {}).filter(([, d]) => d === "disagree").map(([c]) => tname(c)).join("; "),
    (r.added_terms || []).map(tname).join("; "),
    (r.proposals || []).map(p => p.kind === "new" ? `new term: ${p.label}${p.facet ? " (" + p.facet + ")" : ""}` : `synonym: ${p.label} -> ${tname(p.of_id)}`).join("; "),
    r.comment || "", r.updated_at || ""] : Array(9).fill("");
  const RV = ["reviewer", "status", "adaptation decision", "mitigation decision", "AI tags rejected", "terms added", "proposed new terms / synonyms", "comment", "date"];
  const head = ["result_id", "climate_marker", "level", "type", "title", "description", "AI adaptation", "AI mitigation", "AI counted terms", "AI terms not counted",
    "review status", "reviewers agree", ...RV.map(c => "R1 " + c), ...RV.map(c => "R2 " + c)];
  const rows = S.list.map(res => {
    const v = (by[res.id] || []).slice(0, 2), sub = v.filter(r => r.submitted).length, ag = sub >= 2 ? reviewersAgree(res.id) : null;
    return [res.id, res.marker, res.level, res.type, res.title, res.description, res.ai_a, res.ai_m,
      (res.tags || []).filter(isCounted).map(t => t.concept_name).join("; "), (res.tags || []).filter(t => !isCounted(t)).map(t => t.concept_name).join("; "),
      sub >= 2 ? "2 reviews" : sub === 1 ? "1 review" : v.length ? "in progress" : "not reviewed", ag === null ? "" : ag ? "yes" : "no", ...one(v[0]), ...one(v[1])];
  });
  const readme = [["Tagging review: " + S.batch], [],
    ["One row per PRMS result. R1 and R2 are the two reviewers. Use the filters on the 'reviews' sheet."],
    ["adaptation / mitigation decision", "agree = agrees with the AI verdict; should be X = the reviewer's verdict"],
    ["AI tags rejected", "AI tags the reviewer disagreed with"], ["terms added", "taxonomy terms the reviewer added"],
    ["proposed new terms / synonyms", "terms not in the taxonomy, proposed as new terms or as synonyms of an existing term"],
    ["review status", "not reviewed, in progress, 1 review, 2 reviews"],
    ["reviewers agree", "yes when both reviewers end with the same verdicts and the same tags"],
    ["blind rule", "another reviewer's answers appear only once both reviews of that result are submitted"],
    ["downloaded", new Date().toISOString().slice(0, 16).replace("T", " ") + " by " + S.me]];
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: head.length - 1 } }) };
  ws["!cols"] = head.map(h => ({ wch: /title|description|comment|terms|tags|proposed/.test(h) ? 40 : 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "reviews");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(readme), "read me");
  XLSX.writeFile(wb, `review_${S.batch}.xlsx`);
  link.textContent = label;
}

boot();
