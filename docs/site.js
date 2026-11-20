// site.js: search suggestions on every page, and on browse.html the search results and "show in the tree".
// Written by hand. It only reads data/terms.json, which build_fair.R writes from the taxonomy.
(function () {
  const ROOT = document.body.dataset.root || "";
  const PAGE = document.body.dataset.page || "";
  let dataP = null;
  const load = () => dataP || (dataP = fetch(ROOT + "data/terms.json").then(r => r.json()).then(prep));
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-_/,()]+/g, " ").replace(/\s+/g, " ").trim();
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
  const href = id => ROOT + "terms/" + id + ".html";                    // a term always opens its own page

  function prep(d) {
    d.byId = {};
    d.concepts.forEach(c => { d.byId[c.id] = c; c._t = norm(c.t); c._s = (c.s || []).map(norm); });
    d.retired.forEach(r => { r.dep = true; r._t = norm(r.t); r._s = []; d.byId[r.id] = r; });
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
    const t = q.trim(), i = label.toLowerCase().indexOf(t.toLowerCase());
    if (!t || i < 0) return esc(label);
    return esc(label.slice(0, i)) + "<mark>" + esc(label.slice(i, i + t.length)) + "</mark>" + esc(label.slice(i + t.length));
  }
  const line = (r, q) => `<a href="${href(r.c.id)}">${hl(r.c.t, q)}${r.c.dep ? ' <span class="status retired">retired</span>' : ""}` +
    `<span class="f">${esc(r.c.f)}${r.via ? " · synonym: " + esc(r.via) : ""}</span></a>`;

  // a search box with suggestions; Enter without a choice opens the full list on the browse page
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
    document.addEventListener("click", e => { if (!form.contains(e.target)) close(); });
  }
  document.querySelectorAll("form.search").forEach(attach);

  // copy buttons (term address)
  document.addEventListener("click", e => {
    const b = e.target.closest("button.copy"); if (!b) return;
    navigator.clipboard.writeText(b.dataset.copy).then(() => { const t = b.textContent; b.textContent = "Copied"; setTimeout(() => b.textContent = t, 1200); });
  });

  // ---------- browse.html ----------
  const tree = document.getElementById("tree"), results = document.getElementById("results");
  function showInTree(id) {                                             // from a term page's "Show in the tree" button
    tree.querySelectorAll("a.cur").forEach(a => a.classList.remove("cur"));
    const a = tree.querySelector(`a[data-id="${id}"]`); if (!a) return;
    for (let el = a.parentElement; el && el !== tree; el = el.parentElement) if (el.tagName === "DETAILS") el.open = true;
    a.classList.add("cur"); a.scrollIntoView({ block: "center" });
  }
  function showFacet(slug) {
    const det = document.getElementById("facet-" + slug); if (!det) return;
    det.open = true; det.scrollIntoView({ block: "start" });
  }
  async function showResults(q) {
    const d = await load(), res = search(d, q, 60);
    results.innerHTML = `<h2>Search: ${esc(q)}</h2><p class="src">${res.length ? "Terms and synonyms that match. Choose one to open its page." : "No term or synonym matches."}</p>
      <div class="results">${res.map(r => line(r, q)).join("")}</div>`;
    results.hidden = false;
    const input = document.querySelector("form.hsearch input"); if (input) input.value = q;
  }
  function route() {
    const h = decodeURIComponent(location.hash.slice(1)), q = new URLSearchParams(location.search).get("q");
    if (q) showResults(q); else results.hidden = true;
    if (h.startsWith("facet-")) showFacet(h.slice(6)); else if (h) showInTree(h);
  }
  if (PAGE === "browse" && tree && results) { window.addEventListener("hashchange", route); window.addEventListener("popstate", route); route(); }
})();
