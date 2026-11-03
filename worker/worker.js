// Stores the reviews. Rules: two reviewers per result; a reviewer sees the other review only
// once both are submitted; a review is locked once both are submitted.
//   POST /join  {name}             -> {code, name}: identifies a reviewer by name (created if new)
//   GET  /me                       -> {name}
//   GET  /state?batch=B            -> {name, mine: [...], counts: {result_id: {started, submitted}}, done: [...]}
//   POST /review                   -> save or submit your review of one result (body as text/plain)
//   GET  /export?batch=B           -> every review of the batch (for the download file)
// The reviewer is identified by ?r=<personal code> (or the X-Reviewer header).

const JSON_COLS = ["tag_decisions", "added_terms", "proposals"];

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Reviewer",
      "Access-Control-Max-Age": "86400",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const out = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
    try {
      const url = new URL(req.url);
      // join with a name: returns that reviewer's code, creating the reviewer if the name is new
      if (url.pathname === "/join" && req.method === "POST") {
        let name = "";
        try { name = String(JSON.parse(await req.text()).name || ""); } catch (e) {}
        name = name.replace(/\s+/g, " ").trim();
        if (name.length < 2 || name.length > 80) return out({ error: "Please type your first and last name." }, 400);
        const found = await env.DB.prepare("SELECT code, name FROM reviewers WHERE lower(name) = lower(?)").bind(name).first();
        if (found) return out(found);
        const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        await env.DB.prepare("INSERT INTO reviewers (code, name) VALUES (?, ?)").bind(code, name).run();
        return out({ code, name });
      }
      const code = (url.searchParams.get("r") || req.headers.get("X-Reviewer") || "").trim();
      const me = code ? await env.DB.prepare("SELECT code, name FROM reviewers WHERE code = ?").bind(code).first() : null;
      if (!me) return out({ error: "Unknown reviewer link." }, 401);
      const names = Object.fromEntries((await env.DB.prepare("SELECT code, name FROM reviewers").all()).results.map(r => [r.code, r.name]));
      const shape = r => {
        const o = { ...r, reviewer: names[r.reviewer_code] || "?" };
        JSON_COLS.forEach(c => { try { o[c] = JSON.parse(r[c] || "null"); } catch { o[c] = null; } });
        delete o.reviewer_code;            // codes are never sent to other reviewers
        o.mine = r.reviewer_code === me.code;
        return o;
      };

      if (url.pathname === "/me") return out({ name: me.name });

      if (url.pathname === "/state" && req.method === "GET") {
        const b = url.searchParams.get("batch") || "";
        const all = (await env.DB.prepare("SELECT * FROM reviews WHERE batch_id = ?").bind(b).all()).results;
        const counts = {};
        all.forEach(r => { const c = counts[r.result_id] ||= { started: 0, submitted: 0 }; c.started++; if (r.submitted) c.submitted++; });
        const mine = all.filter(r => r.reviewer_code === me.code).map(shape);
        const done = all.filter(r => r.submitted && counts[r.result_id].submitted >= 2).map(shape);
        return out({ name: me.name, mine, counts, done });
      }

      if (url.pathname === "/review" && (req.method === "PUT" || req.method === "POST")) {
        const r = JSON.parse(await req.text());   // sent as text/plain so the browser skips the permission check
        if (!r.result_id || !r.batch_id) return out({ error: "result_id and batch_id are required." }, 400);
        const others = (await env.DB.prepare("SELECT reviewer_code, submitted FROM reviews WHERE result_id = ? AND reviewer_code != ?")
          .bind(r.result_id, me.code).all()).results;
        const otherSubmitted = others.filter(o => o.submitted).length;
        const own = await env.DB.prepare("SELECT submitted FROM reviews WHERE result_id = ? AND reviewer_code = ?").bind(r.result_id, me.code).first();
        if (otherSubmitted >= 2) return out({ error: "This result already has two reviews." }, 409);
        if (own && own.submitted && otherSubmitted >= 1) return out({ error: "Both reviews are submitted; this review is locked." }, 409);
        const b = v => (v === true ? 1 : v === false ? 0 : null);
        await env.DB.prepare(`INSERT INTO reviews (result_id, batch_id, reviewer_code, submitted, adaptation_ok, adaptation_verdict,
            mitigation_ok, mitigation_verdict, tag_decisions, added_terms, proposals, comment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (result_id, reviewer_code) DO UPDATE SET submitted = excluded.submitted,
            adaptation_ok = excluded.adaptation_ok, adaptation_verdict = excluded.adaptation_verdict,
            mitigation_ok = excluded.mitigation_ok, mitigation_verdict = excluded.mitigation_verdict,
            tag_decisions = excluded.tag_decisions, added_terms = excluded.added_terms, proposals = excluded.proposals,
            comment = excluded.comment, updated_at = datetime('now')`)
          .bind(r.result_id, r.batch_id, me.code, r.submitted ? 1 : 0, b(r.adaptation_ok), r.adaptation_verdict || null,
                b(r.mitigation_ok), r.mitigation_verdict || null, JSON.stringify(r.tag_decisions || {}),
                JSON.stringify(r.added_terms || []), JSON.stringify(r.proposals || []), r.comment || null).run();
        const saved = await env.DB.prepare("SELECT * FROM reviews WHERE result_id = ? AND reviewer_code = ?").bind(r.result_id, me.code).first();
        return out(shape(saved));
      }

      if (url.pathname === "/export" && req.method === "GET") {
        const b = url.searchParams.get("batch") || "";
        const all = (await env.DB.prepare("SELECT * FROM reviews WHERE batch_id = ? ORDER BY result_id, created_at").bind(b).all()).results;
        const counts = {};
        all.forEach(r => { if (r.submitted) counts[r.result_id] = (counts[r.result_id] || 0) + 1; });
        // blind rule holds in the file too: another reviewer's answers appear only once both are submitted
        return out(all.filter(r => r.reviewer_code === me.code || (r.submitted && counts[r.result_id] >= 2)).map(shape));
      }

      return out({ error: "Not found." }, 404);
    } catch (e) {
      return out({ error: String(e && e.message || e) }, 500);
    }
  },
};
