// site.js: search suggestions on every page, and the term browser on browse.html.
// Written by hand. It only reads data/terms.json, which build_fair.R writes from the taxonomy.
(function () {
  const ROOT = document.body.dataset.root || "";
  const PAGE = document.body.dataset.page || "";
  let dataP = null;
  const load = () => dataP || (dataP = fetch(ROOT + "data/terms.json").then(r => r.json()).then(prep));
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-_/,()]+/g, " ").replace(/\s+/g, " ").trim();
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
  const href = id => PAGE === "browse" ? "#" + id : ROOT + "terms/" + id + ".html";

  function prep(d) {
    d.byId = {}; d.kids = {};
    d.concepts.forEach(c => {
      d.byId[c.id] = c; c._t = norm(c.t); c._s = (c.s || []).map(norm);
      if (c.p) (d.kids[c.p] = d.kids[c.p] || []).push(c.id);
    });
    d.retired.forEach(r => { r.dep = true; r._t = norm(r.t); r._s = []; d.byId[r.id] = r; });
    Object.values(d.kids).forEach(k => k.sort((a, b) => d.byId[a].t.localeCompare(d.byId[b].t)));
    return d;
  }

  // ranking: identifier, exact label, label start, exact synonym, all words, label contains, synonym contains
  function search(d, q, n) {
    const k = norm(q); if (!k) return [];
    const words = k.split(" "), out = [];
    for (const c of d.concepts.concat(d.retired)) {
      let score = 0, via = "";
      if (c.id.toLowerCase() === k.replace(/ /g, "_")) score = 100;
      else if (c._t === k) score = 95;
      else if (c._t.startsWith(k)) score = 80;
      else if (c._s.includes(k)) { score = 75; via = c.s[c._s.indexOf(k)]; }
      else if (words.every(w => (" " + c._t).includes(" " + w))) score = 60;
      else if (c._t.includes(k)) score = 50;
      else {
        const i = c._s.findIndex(s => s.includes(k) || words.every(w => (" " + s).includes(" " + w)));
        if (i >= 0) { score = 40; via = c.s[i]; }
      }
      if (score) out.push({ c, score: c.dep ? score - 30 : score, via });
    }
    return out.sort((a, b) => b.score - a.score || a.c.t.length - b.c.t.length).slice(0, n);
  }
  function hl(label, q) {
    const i = label.toLowerCase().indexOf(q.trim().toLowerCase());
    if (!q.trim() || i < 0) return esc(label);
    return esc(label.slice(0, i)) + "<mark>" + esc(label.slice(i, i + q.trim().length)) + "</mark>" + esc(label.slice(i + q.trim().length));
  }
  const line = (r, q) => `<a href="${href(r.c.id)}">${hl(r.c.t, q)}${r.c.dep ? ' <span class="status retired">retired</span>' : ""}` +
    `<span class="f">${esc(r.c.id)} · ${esc(r.c.f)}${r.via ? " · synonym: " + esc(r.via) : ""}</span></a>`;

  // a search box with suggestions; Enter without a choice opens the full result list on the browse page
  function attach(form) {
    const input = form.querySelector("input"), box = form.querySelector(".sugg");
    let sel = -1;
    const close = () => { box.hidden = true; sel = -1; };
    const render = async () => {
      const q = input.value;
      if (!norm(q)) return close();
      const d = await load(), items = search(d, q, 8);
      box.innerHTML = items.length ? items.map(r => line(r, q)).join("") : `<div class="none">No term or synonym matches “${esc(q)}”.</div>`;
      box.hidden = false; sel = -1;
    };
    input.addEventListener("input", debounce(render, 120));
    input.addEventListener("focus", () => { load(); if (input.value) render(); });
    input.addEventListener("keydown", e => {
      const links = box.querySelectorAll("a");
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && links.length) {
        e.preventDefault();
        sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
        links.forEach((a, i) => a.classList.toggle("sel", i === sel));
      } else if (e.key === "Escape") close();
    });
    form.addEventListener("submit", e => {
      const links = box.querySelectorAll("a");
      if (sel >= 0 && links[sel]) { e.preventDefault(); close(); location.href = links[sel].getAttribute("href"); }
      else if (PAGE === "browse") { e.preventDefault(); close(); history.pushState(null, "", "?q=" + encodeURIComponent(input.value)); showResults(input.value); }
    });
    box.addEventListener("click", e => { if (e.target.closest("a")) close(); });
    document.addEventListener("click", e => { if (!form.contains(e.target)) close(); });
  }
  document.querySelectorAll("form.search").forEach(attach);

  // copy buttons (term address)
  document.addEventListener("click", e => {
    const b = e.target.closest("button.copy"); if (!b) return;
    navigator.clipboard.writeText(b.dataset.copy).then(() => { const t = b.textContent; b.textContent = "Copied"; setTimeout(() => b.textContent = t, 1200); });
  });

  // ---------- the browser (browse.html) ----------
  const meta = document.getElementById("meta-body"), tree = document.getElementById("tree");
  const termLink = (d, id) => d.byId[id] ? `<a href="#${id}">${esc(d.byId[id].t)}</a>` : esc(id);
  const links = (d, ids) => ids && ids.length ? ids.map(id => termLink(d, id)).join(", ") : "none";
  const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;

  // scroll the tree panel only, never the page
  const reveal = el => { const r = el.getBoundingClientRect(), t = tree.getBoundingClientRect(); tree.scrollTop += r.top - t.top - tree.clientHeight / 3; };
  function mark(id) {
    tree.querySelectorAll("a.cur").forEach(a => a.classList.remove("cur"));
    const a = tree.querySelector(`a[data-id="${id}"]`); if (!a) return;
    for (let el = a.parentElement; el && el !== tree; el = el.parentElement) if (el.tagName === "DETAILS") el.open = true;
    a.classList.add("cur"); reveal(a);
  }
  function showTerm(d, c) {
    const iri = d.base + "terms/" + c.id;
    const change = d.repo + "/issues/new?template=change-term.yml&title=" + encodeURIComponent("[Change] " + c.id + " " + c.t) + "&term_id=" + c.id;
    let rows;
    if (c.dep) {
      rows = row("ID", `<code>${c.id}</code>`) + row("Name", esc(c.t)) + row("Status", '<span class="status retired">retired</span> in version ' + esc(c.v)) +
        row("Replaced by", c.by ? termLink(d, c.by) : "No successor (concept dropped)") + row("Reason", esc(c.why)) + row("Facet", esc(c.f));
    } else {
      const rels = (c.rel || []).map(r => `<span class="k">${esc(r[0])}</span>${termLink(d, r[1])}`).join("<br>");
      const src = c.src ? `<div class="src">Source: ${esc(c.src)}${(c.u || []).map(u => ` · <a href="${esc(u)}">reference</a>`).join("")}</div>` : "";
      rows = row("ID", `<code>${c.id}</code>`) +
        row("Address", `<a href="${iri}">${iri}</a><button class="copy" data-copy="${iri}">Copy</button><div class="src">Planned permanent address: ${esc(d.future + c.id)}</div>`) +
        row("Name", esc(c.t)) + row("Definition", esc(c.d) + src) +
        row("Synonyms", c.s && c.s.length ? esc(c.s.join(", ")) : "none") +
        row("Facet", `<a href="#facet-${c.fs}">${esc(c.f)}</a>`) + row("Pathway stage", esc(c.st)) +
        row("Broader", c.p ? termLink(d, c.p) : "Top concept of the facet") + row("Narrower", links(d, d.kids[c.id])) +
        (rels ? row("Relations", rels) : "") + row("Climate area", esc(c.a)) +
        row("Tagging role", c.r === "Stand-alone" ? "Stand-alone: counts on its own." : "Context-dependent: counts only when " + esc(c.cr)) +
        row("Review status", `<span class="status${c.rv === d.review_ext ? " ext" : ""}">${esc(c.rv)}</span> <span class="src">${esc(d.review[c.rv] || "")}</span>`) +
        (c.ex ? row("Example of use", esc(c.ex)) : "") + row("Provenance", esc(c.pv));
    }
    meta.innerHTML = `<p class="src">${esc(c.f)} · ${esc(c.id)}</p><h2>${esc(c.t)}</h2>
      <div class="actions"><a class="btn primary" href="terms/${c.id}.html">Open the term page</a>${c.dep ? "" : `<a class="btn" href="${change}">Propose a change</a>`}</div>
      <table class="meta">${rows}</table>`;
    mark(c.id); document.title = c.t + " · CGIAR Climate Taxonomy";
  }
  function showFacet(d, slug) {
    const f = d.facets.find(x => x.slug === slug); if (!f) return;
    const det = document.getElementById("facet-" + slug); if (det) { det.open = true; reveal(det); }
    meta.innerHTML = `<p class="src">Facet · prefix ${esc(f.prefix)}</p><h2>${esc(f.name)}</h2><p class="def">${esc(f.def)}</p>
      <p>${f.n} terms, ${f.top.length} top concepts:</p><p>${links(d, f.top)}</p>`;
  }
  async function showResults(q) {
    const d = await load(), res = search(d, q, 60);
    meta.innerHTML = `<h2>Search: ${esc(q)}</h2><p class="src">${res.length ? res.length + (res.length === 60 ? "+" : "") + " matching terms and synonyms" : "No term or synonym matches."}</p>
      <div class="results">${res.map(r => line(r, q)).join("")}</div>`;
  }
  async function browse() {
    const d = await load();
    const show = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (h.startsWith("facet-")) return showFacet(d, h.slice(6));
      if (h && d.byId[h]) return showTerm(d, d.byId[h]);
      const q = new URLSearchParams(location.search).get("q");
      if (q) { document.querySelector("form.hsearch input").value = q; return showResults(q); }
    };
    window.addEventListener("hashchange", show); window.addEventListener("popstate", show); show();
  }
  if (PAGE === "browse" && meta && tree) browse();
})();
