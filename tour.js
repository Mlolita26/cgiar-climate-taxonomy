// Guided tour: a spotlight moves over each part of the screen, with short live demonstrations.
// Shown once per browser on the first visit; the "How to review" button replays it. Nothing is saved by the tour.
const Tour = (() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (sel, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { const el = document.querySelector(sel); if (el) return el; await wait(60); } return null; };
  let i = 0, steps = [], box, hole, card, cleanup = null, running = false;

  async function typeInto(el, text) {
    el.value = ""; el.dispatchEvent(new Event("input"));
    for (const ch of text) { if (!running) return; el.value += ch; el.dispatchEvent(new Event("input")); await wait(70); }
  }
  const clear = sel => { const el = document.querySelector(sel); if (el) { el.value = ""; el.dispatchEvent(new Event("input")); } const h = document.querySelector("#hits"); if (h) h.innerHTML = ""; };

  function pickResult() {
    const r = S.list.find(x => bucket(x) === "todo") || S.list.find(x => bucket(x) === "waiting");
    return r && r.id;
  }
  async function openReview() {
    const id = pickResult(); if (!id) return false;
    if (location.hash !== "#/r/" + encodeURIComponent(id)) location.hash = "#/r/" + encodeURIComponent(id);
    return !!(await until("#q", 8000));
  }
  async function openList() { if (!location.hash.startsWith("#/list")) location.hash = "#/list/todo"; await until("#tabs .tab"); }

  function build() {
    steps = [
      { title: "Welcome", text: "You will check how the AI tagged PRMS results against the climate taxonomy. Each result is reviewed by two people. You do not see the other person's answers until you have both submitted.", at: openList },
      { el: "#namebar", title: "First, your name", text: "Type your first and last name and press Start. It identifies your reviews and is shown to the other reviewers. This browser remembers you next time.", at: openList,
        skipIf: () => !!S.code, demo: async () => { const n = document.querySelector("#nm"); await typeInto(n, "Jane Doe"); }, undo: () => { const n = document.querySelector("#nm"); if (n) n.value = ""; } },
      { el: "#who", title: "That's you", text: "Your name stays here. If it is not you, for example on a shared computer, click change.", at: openList, skipIf: () => !S.code },
      { el: "#tabs", title: "Your queues", text: "To review: results waiting for you. Waiting for 2nd review: you submitted, the other reviewer has not. Done: both reviews are in, split into agree and disagree.", at: openList },
      { el: "#tabs .tab:first-child", title: "Start here", text: "Open To review and click a result. We will open one now.", at: openList },
      { el: ".text", title: "The result", text: "The title and description as reported in PRMS. Yellow: terms the AI counted. Grey: terms it found but did not count, because the climate context was missing. Blue: terms you add. Click a highlight to find its row in the tags table.", at: openReview, side: "right" },
      { el: ".side > section:nth-of-type(1)", title: "1. The AI verdict", text: "For adaptation and for mitigation, the AI says how complete the climate evidence is: Full, Partial, Minimal or None. Click Agree, or Disagree and choose what it should be.", at: openReview, pulse: ".side > section:nth-of-type(1) .seg span" },
      { el: ".side > section:nth-of-type(2)", title: "2. The AI tags", text: "Each taxonomy term the AI found, with its facet, its role and whether it counts. Every tag starts as ✓. Click ✗ on the ones that are wrong.", at: openReview, pulse: "table.tags tbody tr:first-child .segs" },
      { el: ".side > section:nth-of-type(3)", title: "3. Add a missing term", text: "Search by term or synonym, then click + add.", at: openReview,
        demo: async () => { const q = document.querySelector("#q"); q.scrollIntoView({ block: "center" }); await typeInto(q, "drought"); }, undo: () => clear("#q") },
      { el: ".side > section:nth-of-type(3)", title: "Not in the taxonomy?", text: "If nothing fits, propose it: as a new term (choose its facet) or as a synonym of an existing term. Proposals go to the people who maintain the taxonomy.", at: openReview,
        demo: async () => { const q = document.querySelector("#q"); await typeInto(q, "groundwater recharge zone"); }, undo: () => clear("#q") },
      { el: "#brw", title: "Browse the taxonomy", text: "Prefer to look around? Open the tree: facets, then terms, then their narrower terms. Click a name to read its definition.", at: openReview },
      { el: ".side > section:nth-of-type(5)", title: "4. Comment", text: "Anything the other reviewer and the taxonomy team should know: why you disagree, a doubt, a pattern you notice.", at: openReview },
      { el: ".actions", title: "5. Save or submit", text: "Save draft keeps your answers and lets you come back. Submit sends them and takes you to the next result. You can change a submitted review until the second reviewer submits.", at: openReview },
      { el: "#exp", title: "The file", text: "Download file gives one Excel sheet: one row per result, the AI's answer, then each reviewer's answers side by side.", at: openList },
      { title: "That's it", text: "You can replay this tour with How to review, at the top right.", at: openList, last: true },
    ];
  }

  function place(el, side) {
    const pad = 8, vw = innerWidth, vh = innerHeight;
    if (!el) { Object.assign(hole.style, { top: vh / 2 + "px", left: vw / 2 + "px", width: "0px", height: "0px" }); card.classList.add("center"); card.style.top = card.style.left = ""; return; }
    card.classList.remove("center");
    const r = el.getBoundingClientRect();
    const top = Math.max(r.top - pad, 4), left = Math.max(r.left - pad, 4), h = Math.min(r.height + 2 * pad, vh - top - 4), w = Math.min(r.width + 2 * pad, vw - left - 4);
    Object.assign(hole.style, { top: top + "px", left: left + "px", width: w + "px", height: h + "px" });
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let ct, cl;
    if (side === "right" && left + w + 16 + cw < vw) { ct = top; cl = left + w + 16; }
    else if (top + h + 16 + ch < vh) { ct = top + h + 16; cl = left; }
    else if (top - 16 - ch > 0) { ct = top - 16 - ch; cl = left; }
    else if (left - 16 - cw > 0) { ct = top; cl = left - 16 - cw; }
    else { ct = vh - ch - 16; cl = vw - cw - 16; }
    card.style.top = Math.max(12, Math.min(ct, vh - ch - 12)) + "px";
    card.style.left = Math.max(12, Math.min(cl, vw - cw - 12)) + "px";
  }

  async function show(n, dir = 1) {
    if (!running) return;
    while (steps[n] && steps[n].skipIf && steps[n].skipIf()) n += dir;
    if (!steps[n]) return dir > 0 ? end() : show(0, 1);
    if (cleanup) { cleanup(); cleanup = null; }
    $$(".tour-pulse").forEach(e => e.classList.remove("tour-pulse"));
    i = n; const s = steps[i];
    card.classList.add("fade");
    if (s.at) await s.at();
    const el = s.el ? await until(s.el) : null;
    if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); await wait(380); }
    const vis = steps.filter(x => !(x.skipIf && x.skipIf()));
    card.innerHTML = `<div class="tour-k">${vis.indexOf(s) + 1} / ${vis.length}</div><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p>
      <div class="tour-b"><a href="#" class="tour-skip">${s.last ? "" : "Skip"}</a><span>${vis.indexOf(s) > 0 ? `<button class="tour-prev">Back</button>` : ""}<button class="primary tour-next">${s.last ? (S.code ? "Start reviewing" : "Enter my name") : "Next"}</button></span></div>`;
    place(el, s.side);
    card.classList.remove("fade");
    $(".tour-next", card).onclick = () => (s.last ? end() : show(i + 1));
    if ($(".tour-prev", card)) $(".tour-prev", card).onclick = () => show(i - 1, -1);
    $(".tour-skip", card).onclick = e => { e.preventDefault(); end(); };
    if (s.pulse) $$(s.pulse).slice(0, 2).forEach(e => e.classList.add("tour-pulse"));
    if (s.undo) cleanup = s.undo;                     // set before the demo, so closing mid-demo still cleans up
    if (s.demo) { await s.demo(); await wait(300); if (running && steps[i] === s) place(document.querySelector(s.el), s.side); }
  }

  function end() {
    running = false;
    if (!S.code) setTimeout(() => { const n = document.querySelector("#nm"); if (n) n.focus(); }, 350);
    if (cleanup) { cleanup(); cleanup = null; }
    $$(".tour-pulse").forEach(e => e.classList.remove("tour-pulse"));
    box.classList.add("out"); setTimeout(() => box.remove(), 300);
    try { localStorage.setItem("rv_tour_seen", "1"); } catch (e) {}
    removeEventListener("resize", onResize);
  }
  const onResize = () => { const s = steps[i]; place(s && s.el ? document.querySelector(s.el) : null, s && s.side); };

  function start() {
    if (running) return; running = true; build();
    box = document.createElement("div"); box.className = "tour";
    box.innerHTML = `<div class="tour-hole"></div><div class="tour-card fade"></div>`;
    document.body.appendChild(box);
    hole = $(".tour-hole", box); card = $(".tour-card", box);
    addEventListener("resize", onResize);
    document.addEventListener("keydown", e => { if (!running) return; if (e.key === "Escape") end(); if (e.key === "ArrowRight") $(".tour-next", card)?.click(); if (e.key === "ArrowLeft") $(".tour-prev", card)?.click(); });
    requestAnimationFrame(() => box.classList.add("in"));
    show(0);
  }
  function maybeStart() { let seen = null; try { seen = localStorage.getItem("rv_tour_seen"); } catch (e) {} if (!seen) setTimeout(start, 500); }
  return { start, maybeStart, running: () => running };
})();
