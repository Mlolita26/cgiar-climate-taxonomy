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
    // v6 batches: a result with climate information, so that the area cards have questions to show
    const lv = x => (x.adaptation || {}).level || "";
    const r = (S.form === "v6" && (S.list.find(x => bucket(x) === "todo" && (lv(x) === "L2" || lv(x) === "L3"))
                                   || S.list.find(x => bucket(x) === "todo" && lv(x) && lv(x) !== "L0")))
      || S.list.find(x => bucket(x) === "todo") || S.list.find(x => bucket(x) === "waiting");
    return r && r.id;
  }
  async function openReview() {
    const id = pickResult(); if (!id) return false;
    if (location.hash !== "#/r/" + encodeURIComponent(id)) location.hash = "#/r/" + encodeURIComponent(id);
    return !!(await until("#q", 8000));
  }
  async function openList() { if (!location.hash.startsWith("#/list")) location.hash = "#/list/todo"; await until("#tabs .tab"); }

  function build() {
    if (S.form === "v6") { steps = stepsV6(); return; }
    steps = [
      { title: "Welcome", text: "You will check how the AI tagged PRMS results against the climate taxonomy. Each result is reviewed by two people. You do not see the other person's answers until you have both submitted.", at: openList },
      { el: "#namebar", title: "First, your name", text: "Type your first and last name and press Start. It identifies your reviews and is shown to the other reviewers. This browser remembers you next time.", at: openList,
        skipIf: () => !!S.code, demo: async () => { const n = document.querySelector("#nm"); await typeInto(n, "Jane Doe"); }, undo: () => { const n = document.querySelector("#nm"); if (n) n.value = ""; } },
      { el: "#who", title: "That's you", text: "Your name stays here. If it is not you, for example on a shared computer, click change.", at: openList, skipIf: () => !S.code },
      { el: "#tabs", title: "Your queues", text: "To review: results waiting for you. Waiting for 2nd review: you submitted, the other reviewer has not. Done: both reviews are in, split into agree and disagree.", at: openList },
      { el: "table.list tbody tr:first-child", title: "This is one result to review", text: "Each row in the list is one PRMS result. Click on it to open it and review it. We will open this one for you.", at: openList,
        pulse: "table.list tbody tr:first-child", demo: async () => { await wait(1400); const r = document.querySelector("table.list tbody tr:first-child"); if (r && running) { r.classList.add("tour-press"); await wait(260); r.classList.remove("tour-press"); } } },
      { el: ".text", title: "The result", text: "The title and description as reported in PRMS. Yellow: terms the AI counted. Grey: terms it found but did not count, because the climate context was missing. Blue: terms you add. Click a highlight to find its row in the tags table.", at: openReview, side: "right" },
      { el: ".side > section:nth-of-type(1)", title: "1. The AI verdict", text: "For adaptation and for mitigation, the AI says how complete the climate evidence is: Full, Partial, Minimal or None. Click Agree, or Disagree and choose what it should be.", at: openReview, pulse: ".side > section:nth-of-type(1) .seg span" },
      { el: ".side > section:nth-of-type(2)", title: "2. The AI tags", text: "Each taxonomy term the AI found, with its facet, its role and whether it counts. Every tag starts as ✓. Click ✗ on the ones that are wrong.", at: openReview, pulse: "table.tags tbody tr:first-child .segs" },
      { el: ".side > section:nth-of-type(3)", title: "3. Add a missing term", text: "Search by term or synonym, then click + add.", at: openReview,
        demo: async () => { const q = document.querySelector("#q"); q.scrollIntoView({ block: "center" }); await typeInto(q, "drought"); }, undo: () => clear("#q") },
      { el: ".text", title: "Or tag straight from the text", text: "Select a word or phrase in the title or description (double-click a word, or drag over several). A box opens with the matching terms: click + add. If nothing fits, propose it from there.", at: openReview, side: "right",
        demo: async () => { await wait(300); demoPick(); }, undo: () => { closePick(); getSelection().removeAllRanges(); } },
      { el: ".side > section:nth-of-type(3)", title: "Not in the taxonomy?", text: "If nothing fits, propose it: as a new term (choose its facet) or as a synonym of an existing term. Proposals go to the people who maintain the taxonomy.", at: openReview,
        demo: async () => { const q = document.querySelector("#q"); await typeInto(q, "groundwater recharge zone"); }, undo: () => clear("#q") },
      { el: "#brw", title: "Browse the taxonomy", text: "Prefer to look around? Open the tree: facets, then terms, then their narrower terms. Click a name to read its definition.", at: openReview },
      { el: ".side > section:nth-of-type(5)", title: "4. Comment", text: "Anything the other reviewer and the taxonomy team should know: why you disagree, a doubt, a pattern you notice.", at: openReview },
      { el: ".actions", title: "5. Save or submit", text: "Save draft keeps your answers and lets you come back. Submit sends them and takes you to the next result. You can change a submitted review until the second reviewer submits.", at: openReview },
      { el: "#exp", title: "The file", text: "Download file gives one Excel sheet: one row per result, the AI's answer, then each reviewer's answers side by side.", at: openList },
      { title: "That's it", text: "You can replay this tour with How to review, at the top right.", at: openList, last: true },
    ];
  }

  // the tour of the form for batches under the CGIAR tagging standard (form "v6")
  function stepsV6() {
    const open = el => () => { const d = document.querySelector(el); if (d && !d.open) d.open = true; };
    return [
      { title: "Welcome", text: "You will check how the AI tagged PRMS results under the CGIAR tagging standard, with taxonomy v6. Each result is reviewed by two people. You do not see the other person's answers until you have both submitted.", at: openList },
      { el: "#namebar", title: "First, your name", text: "Type your first and last name and press Start. It identifies your reviews and is shown to the other reviewers. This browser remembers you next time.", at: openList,
        skipIf: () => !!S.code, demo: async () => { const n = document.querySelector("#nm"); await typeInto(n, "Jane Doe"); }, undo: () => { const n = document.querySelector("#nm"); if (n) n.value = ""; } },
      { el: "#who", title: "That's you", text: "Your name stays here. If it is not you, for example on a shared computer, click change.", at: openList, skipIf: () => !S.code },
      { el: "#tabs", title: "Your queues", text: "To review: results waiting for you. Waiting for 2nd review: you submitted, the other reviewer has not. Done: both reviews are in, split into agree and disagree on the levels and the marker answer.", at: openList },
      { el: "table.list tbody tr:first-child", title: "This is one result to review", text: "Each row is one PRMS result, with the AI's level for adaptation and for mitigation (L0 to L3) and its marker answer. Click on a row to open it. We will open one for you.", at: openList,
        pulse: "table.list tbody tr:first-child", demo: async () => { await wait(1400); const r = document.querySelector("table.list tbody tr:first-child"); if (r && running) { r.classList.add("tour-press"); await wait(260); r.classList.remove("tour-press"); } } },
      { el: ".text", title: "The result", text: "The title and description as reported in PRMS. Yellow: taxonomy terms that count as climate information, stand-alone or anchored. Grey: terms found that do not count. Blue: terms you add. Only the taxonomy term or synonym is highlighted. Click a highlight to find its row in the tag table.", at: openReview, side: "right" },
      { el: "#v6-intro", title: "What to do", text: "Check each answer on the right. The answers start as the AI's: change only what is wrong, then submit. The flags are points the tagging script asks a person to look at first.", at: openReview },
      { el: "#v6-area-adaptation .hlp", title: "The ? buttons", text: "Each ? opens a short explanation of the question or the value next to it, with a link to the Rules page for more. Click it again to close it.", at: openReview,
        demo: async () => { const d = document.querySelector("#v6-area-adaptation .hlp"); if (d) { await wait(600); d.open = true; } }, undo: () => { const d = document.querySelector("#v6-area-adaptation .hlp"); if (d) d.open = false; } },
      { el: "#v6-area-adaptation", title: "One card per area", text: "Climate information: the terms that count for the area. Climate measure: keep the AI's answer, say it is not a measure and why, or paste the passage of a measure the AI missed. Purpose: main, additional or not stated, with the test that shows it. Questions that do not apply are greyed out.", at: openReview },
      { el: "#v6-path", title: "The climate pathway", text: "Folded: reason, where, who, what was done, what came out, the links between them, and whether the work is planned or done. Open it when you need it, and note any pathway part to correct.", at: openReview, demo: async () => { open("#v6-pathway")(); }, undo: () => { const d = document.querySelector("#v6-pathway"); if (d) d.open = false; } },
      { el: "#v6-tags", title: "The AI tags", text: "Two groups. Tags that count: an area says stand-alone or anchored. Tags that do not count: every area says no anchor or not relevant; the term is tagged but is not climate information, and the row says why. Every tag starts as agreed. Click change to correct a value (the tag moves to the other group if it should), or ✗ to refuse it with a reason.", at: openReview, pulse: "table.v6t tbody tr:first-child .segs" },
      { el: "#v6-dropped", title: "Words found but not tagged", text: "Words the term search found that the AI or the code decided are not a tag here, with the reason. Click + keep to add one as your tag.", at: openReview },
      { el: "#v6-add", title: "Add a missing term", text: "Search by term or synonym, then click + add, and tick the area for which it counts.", at: openReview,
        demo: async () => { const q = document.querySelector("#q"); q.scrollIntoView({ block: "center" }); await typeInto(q, "drought"); }, undo: () => clear("#q") },
      { el: ".text", title: "Or tag straight from the text", text: "Select a word or phrase in the title or description (double-click a word, or drag over several). A box opens with the matching terms: click + add. If nothing fits, propose it from there.", at: openReview, side: "right",
        demo: async () => { await wait(300); demoPick(); }, undo: () => { closePick(); getSelection().removeAllRanges(); } },
      { el: "#v6-add", title: "Not in the taxonomy?", text: "If nothing fits, propose it: as a new term (choose its facet) or as a synonym of an existing term. Proposals go to the people who maintain the taxonomy.", at: openReview,
        demo: async () => { const q = document.querySelector("#q"); await typeInto(q, "groundwater recharge zone"); }, undo: () => clear("#q") },
      { el: "#v6-findings", title: "The AI's taxonomy findings", text: "Unmatched climate phrases and possible misclassifications the AI recorded. Accept, reject or leave each one for later. These answers go to the people who maintain the taxonomy and do not change the outcome of your review.", at: openReview },
      { el: "#v6-comment", title: "Comment", text: "Anything the other reviewer and the taxonomy team should know: why you disagree, a doubt, a pattern you notice.", at: openReview },
      { el: "#v6-gives", title: "What your answers give", text: "Folded on purpose: the levels and marker answer that follow from your answers, and the outcome of your review. You do not set them. Open it if you want to check.", at: openReview },
      { el: ".actions", title: "Save or submit", text: "Save draft keeps your answers and lets you come back. Submit checks that every question that applies is answered, sends your review and takes you to the next result. You can change a submitted review until the second reviewer submits.", at: openReview },
      { el: "#rules", title: "The Rules page", text: "Rules opens a page, in a new tab, that explains every question, value and outcome of this form. The ? buttons link to its sections.", at: openReview },
      { el: "#exp", title: "The file", text: "Download file gives one Excel file: one row per result with the AI's levels and marker answer, then each reviewer's answers side by side, plus a sheet of tags and a sheet of taxonomy findings.", at: openList },
      { title: "That's it", text: "You can replay this tour with How to review, at the top right. The Rules page is next to it.", at: openList, last: true },
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
    let el = s.el ? await until(s.el) : null;
    if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); await wait(380); el = document.querySelector(s.el) || el; }   // measure the element on the page now (the list may have been redrawn)
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
