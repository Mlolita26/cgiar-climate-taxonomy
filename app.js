// Tagging review. Plain JS, no build step. Data and logins in Supabase (tables rv_*).
const sb = supabase.createClient(CONFIG.url, CONFIG.key);
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const VERDICTS = ["Full", "Partial", "Minimal", "None"];
const COUNTED = ["specific", "conditional_met"];

const S = {
  user: null, names: {}, batch: null, batches: [],
  terms: {}, kids: {}, facets: [],
  list: [], status: {}, mine: {}, others: {},   // others: reviews of finished results, by result id
  tab: "todo", cur: null, rev: null,
};

// ---------------------------------------------------------------- start
async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return login();
  S.user = data.session.user;
  const { data: me } = await sb.from("rv_reviewers").select("*").eq("id", S.user.id).maybeSingle();
  if (!me) return askName();
  const [{ data: rs }, { data: bs }] = await Promise.all([
    sb.from("rv_reviewers").select("id,name"), sb.from("rv_batches").select("*").order("created_at")]);
  (rs || []).forEach(r => S.names[r.id] = r.name);
  S.batches = bs || [];
  $("#who").innerHTML = `${esc(me.name)} · <a href="#" id="out">sign out</a>`;
  $("#out").onclick = async e => { e.preventDefault(); await sb.auth.signOut(); location.hash = ""; location.reload(); };
  await loadTerms();
  const sel = $("#batch");
  sel.innerHTML = S.batches.map(b => `<option value="${esc(b.id)}">${esc(b.name || b.id)}</option>`).join("");
  S.batch = localStorage.getItem("rv_batch") || (S.batches[0] || {}).id;
  if (!S.batches.find(b => b.id === S.batch)) S.batch = (S.batches[0] || {}).id;
  sel.value = S.batch || "";
  sel.onchange = async () => { S.batch = sel.value; localStorage.setItem("rv_batch", S.batch); await loadBatch(); location.hash = "#/list/todo"; route(); };
  if (!S.batch) { $("#main").innerHTML = "<p>No batch loaded yet.</p>"; return; }
  await loadBatch();
  window.onhashchange = route;
  route();
}

function login() {
  $("#tabs").innerHTML = ""; $("#batch").style.display = "none";
  $("#main").innerHTML = `<div class="login">
    <h2>Sign in</h2>
    <input id="em" type="email" placeholder="email" autocomplete="username">
    <input id="pw" type="password" placeholder="password" autocomplete="current-password">
    <div class="bar"><button class="main" id="in">Sign in</button><button id="up">Create account</button></div>
    <p id="msg" class="small"></p></div>`;
  const go = async signup => {
    const email = $("#em").value.trim(), password = $("#pw").value;
    const r = signup ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
    if (r.error) return $("#msg").textContent = r.error.message;
    if (signup && !r.data.session) return $("#msg").textContent = "Check your email to confirm the account, then sign in.";
    location.reload();
  };
  $("#in").onclick = () => go(false); $("#up").onclick = () => go(true);
  $("#pw").onkeydown = e => { if (e.key === "Enter") go(false); };
}

function askName() {
  $("#main").innerHTML = `<div class="login"><h2>Your name</h2><p class="small">Shown to the other reviewers.</p>
    <input id="nm" placeholder="First and last name"><div class="bar"><button class="main" id="ok">Save</button></div><p id="msg" class="small"></p></div>`;
  $("#ok").onclick = async () => {
    const name = $("#nm").value.trim(); if (!name) return;
    const { error } = await sb.from("rv_reviewers").insert({ id: S.user.id, name });
    if (error) return $("#msg").textContent = error.message;
    location.reload();
  };
}

// ---------------------------------------------------------------- data
async function loadTerms() {
  let all = [], from = 0;
  while (true) {
    const { data, error } = await sb.from("rv_terms").select("*").range(from, from + 999);
    if (error || !data.length) break;
    all = all.concat(data); if (data.length < 1000) break; from += 1000;
  }
  S.terms = {}; S.kids = {};
  all.forEach(t => { S.terms[t.id] = t; (S.kids[t.parent_id || "_" + t.facet] ||= []).push(t.id); });
  Object.values(S.kids).forEach(a => a.sort((x, y) => S.terms[x].term.localeCompare(S.terms[y].term)));
  const n = {}; all.forEach(t => n[t.facet] = (n[t.facet] || 0) + 1);
  S.facets = Object.keys(n).sort((a, b) => n[b] - n[a]);
}

async function loadBatch() {
  const cols = "id,title,climate_marker,level,type,ai_adaptation,ai_mitigation,ai_scope";
  const [{ data: rs }, { data: st }, { data: mine }] = await Promise.all([
    sb.from("rv_results").select(cols).eq("batch_id", S.batch).order("id"),
    sb.from("rv_result_status").select("*").eq("batch_id", S.batch),
    sb.from("rv_reviews").select("*").eq("reviewer_id", S.user.id)]);
  S.list = (rs || []).sort((a, b) => (+a.id || 0) - (+b.id || 0));
  S.status = {}; (st || []).forEach(s => S.status[s.result_id] = s);
  S.mine = {}; (mine || []).forEach(r => S.mine[r.result_id] = r);
  const done = S.list.filter(r => n2(r.id) >= 2).map(r => r.id);
  S.others = {};
  for (let i = 0; i < done.length; i += 200) {
    const { data } = await sb.from("rv_reviews").select("*").in("result_id", done.slice(i, i + 200)).eq("submitted", true);
    (data || []).forEach(v => (S.others[v.result_id] ||= []).push(v));
  }
  S.full = {};
}
const n2 = id => (S.status[id] || {}).n_submitted || 0;

async function fullResult(id) {
  if (S.full[id]) return S.full[id];
  const { data } = await sb.from("rv_results").select("*").eq("id", id).single();
  return (S.full[id] = data);
}

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
    + ` <a href="#" id="exp">Export</a>`;
  $("#exp").onclick = e => { e.preventDefault(); exportCsv(); };
}

function listView() {
  tabs();
  const rows = S.list.filter(r => bucket(r) === S.tab);
  const who = id => (S.others[id] || []).map(v => esc(S.names[v.reviewer_id] || "?")).join(", ");
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
  S.rev = m ? JSON.parse(JSON.stringify(m)) : { result_id: id, adaptation_ok: null, adaptation_verdict: null, mitigation_ok: null,
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
  const row = { result_id: R.result_id, reviewer_id: S.user.id, submitted: submit || !!(S.mine[R.result_id] || {}).submitted,
    adaptation_ok: R.adaptation_ok, adaptation_verdict: R.adaptation_verdict, mitigation_ok: R.mitigation_ok, mitigation_verdict: R.mitigation_verdict,
    tag_decisions: R.tag_decisions, added_terms: R.added_terms, proposals: R.proposals, comment: R.comment, updated_at: new Date().toISOString() };
  const { data, error } = await sb.from("rv_reviews").upsert(row, { onConflict: "result_id,reviewer_id" }).select().single();
  if (error) return msg.textContent = error.message;
  S.mine[R.result_id] = data;
  const { data: st } = await sb.from("rv_result_status").select("*").eq("result_id", R.result_id).single();
  if (st) S.status[R.result_id] = st;
  if (!submit) { msg.textContent = "Saved."; tabs(); return; }
  if (n2(R.result_id) >= 2) await loadBatch();
  const next = S.list.find(r => bucket(r) === "todo" && r.id !== R.result_id);
  location.hash = next ? "#/r/" + encodeURIComponent(next.id) : "#/list/todo";
}

// ---------------------------------------------------------------- both reviews side by side
function compareView(res) {
  const v = (S.others[res.id] || []).slice(0, 2);
  const nm = r => esc(S.names[r.reviewer_id] || "?");
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

// ---------------------------------------------------------------- export: one CSV, one row per review
async function exportCsv() {
  const ids = S.list.map(r => r.id); let all = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from("rv_reviews").select("*").in("result_id", ids.slice(i, i + 200));
    all = all.concat(data || []);
  }
  const head = ["result_id", "reviewer", "submitted", "adaptation_ok", "adaptation_verdict", "mitigation_ok", "mitigation_verdict",
    "tags_disagreed", "terms_added", "proposals", "comment", "updated_at"];
  const q = s => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = all.map(r => [r.result_id, S.names[r.reviewer_id] || r.reviewer_id, r.submitted, r.adaptation_ok, r.adaptation_verdict, r.mitigation_ok, r.mitigation_verdict,
    Object.entries(r.tag_decisions || {}).filter(([, d]) => d === "disagree").map(([c]) => c).join("; "),
    (r.added_terms || []).join("; "), (r.proposals || []).map(p => `${p.kind}:${p.label}${p.of_id ? "->" + p.of_id : ""}${p.facet ? " (" + p.facet + ")" : ""}`).join("; "),
    r.comment, r.updated_at].map(q).join(","));
  const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `reviews_${S.batch}.csv`; a.click();
}

boot();
