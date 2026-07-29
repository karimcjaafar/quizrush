// QuizRush API — Cloudflare Worker + D1.
// Endpoints:
//   POST /answers      [{k, c}]                 — batch answer stats
//   GET  /stats?k=     → {right, wrong}         — global stats for one question
//   POST /daily        {date,id,name,avatar,score,time,won} — daily result (one per device/day)
//   GET  /leaderboard?date= → {top,players,solved}
//   POST /score        {mode,id,name,avatar,score} — best per device per mode
//   GET  /scores?mode= → {top,players}

// The modes that carry a global leaderboard (Your Rules is self-configured, so
// it isn't globally comparable and is deliberately excluded).
const SCORE_MODES = ["classic", "sudden", "blitz", "whoami", "dingbats"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    try {
      if (url.pathname === "/answers" && req.method === "POST") {
        const body = await req.json();
        const list = (Array.isArray(body) ? body : []).slice(0, 60);
        for (const a of list) {
          if (typeof a.k !== "string" || !a.k || a.k.length > 24) continue;
          await env.DB.prepare(
            `INSERT INTO answers (qkey, right, wrong) VALUES (?1, ?2, ?3)
             ON CONFLICT(qkey) DO UPDATE SET right = right + ?2, wrong = wrong + ?3`
          ).bind(a.k, a.c ? 1 : 0, a.c ? 0 : 1).run();
        }
        return json({ ok: true });
      }

      if (url.pathname === "/stats" && req.method === "GET") {
        const k = (url.searchParams.get("k") || "").slice(0, 24);
        const row = await env.DB.prepare(
          "SELECT right, wrong FROM answers WHERE qkey = ?1"
        ).bind(k).first();
        return json(row || { right: 0, wrong: 0 });
      }

      if (url.pathname === "/daily" && req.method === "POST") {
        const b = await req.json();
        const date = String(b.date || "");
        const device = String(b.id || "").slice(0, 40);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !device) return json({ error: "bad request" }, 400);
        await env.DB.prepare(
          `INSERT INTO daily (date, device, name, avatar, score, time, won)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(date, device) DO NOTHING`
        ).bind(
          date,
          device,
          String(b.name || "Player").slice(0, 16),
          String(b.avatar || "😀").slice(0, 8),
          Math.max(0, Math.min(100000, Math.round(Number(b.score) || 0))),
          Math.max(0, Math.min(60, Number(b.time) || 0)),
          b.won ? 1 : 0
        ).run();
        return json({ ok: true });
      }

      if (url.pathname === "/leaderboard" && req.method === "GET") {
        const date = url.searchParams.get("date") || "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "bad request" }, 400);
        const rows = await env.DB.prepare(
          `SELECT name, avatar, score, time, won FROM daily
           WHERE date = ?1 ORDER BY won DESC, score DESC, time ASC LIMIT 20`
        ).bind(date).all();
        const totals = await env.DB.prepare(
          "SELECT COUNT(*) AS n, COALESCE(SUM(won), 0) AS solved FROM daily WHERE date = ?1"
        ).bind(date).first();
        return json({ top: rows.results, players: totals.n, solved: totals.solved });
      }

      if (url.pathname === "/score" && req.method === "POST") {
        const b = await req.json();
        const mode = String(b.mode || "");
        const device = String(b.id || "").slice(0, 40);
        if (!SCORE_MODES.includes(mode) || !device) return json({ error: "bad request" }, 400);
        await env.DB.prepare(
          `INSERT INTO scores (mode, device, name, avatar, score, at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)
           ON CONFLICT(mode, device) DO UPDATE SET
             name = ?3, avatar = ?4, at = ?6, score = MAX(score, ?5)`
        ).bind(
          mode,
          device,
          String(b.name || "Player").slice(0, 16),
          String(b.avatar || "😀").slice(0, 8),
          Math.max(0, Math.min(10000000, Math.round(Number(b.score) || 0))),
          Date.now()
        ).run();
        return json({ ok: true });
      }

      if (url.pathname === "/scores" && req.method === "GET") {
        const mode = url.searchParams.get("mode") || "";
        if (!SCORE_MODES.includes(mode)) return json({ error: "bad request" }, 400);
        const rows = await env.DB.prepare(
          `SELECT name, avatar, score FROM scores
           WHERE mode = ?1 ORDER BY score DESC, at ASC LIMIT 20`
        ).bind(mode).all();
        const totals = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM scores WHERE mode = ?1"
        ).bind(mode).first();
        return json({ top: rows.results, players: totals.n });
      }

      return json({ error: "not found" }, 404);
    } catch {
      return json({ error: "server error" }, 500);
    }
  },
};
