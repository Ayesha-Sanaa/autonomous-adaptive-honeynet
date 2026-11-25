const http = require("http");
const { MongoClient } = require("mongodb");
const { MemoryMongoClient, seedMemoryDb } = require("./memory-db");
const { attackersPipeline, sessionsPipeline, shapeAttacker, shapeSession } = require("./analytics");
const auth = require("./auth");
const { CrdtState } = require("./crdt");
const { loadHoneytokens } = require("./honeytokens");

const CRDT_TOKEN = process.env.CRDT_TOKEN || "";
const SIDECAR_URL = process.env.SIDECAR_URL || "http://localhost:5000";
const CRDT_PEERS = (process.env.CRDT_PEERS ||
  "cowrie=http://cowrie-crdt:7000,web-portal=http://web-portal-crdt:7000,heralding=http://heralding-crdt:7000,dionaea=http://dionaea-crdt:7000")
  .split(",")
  .map((s) => s.trim().split("="))
  .filter((p) => p.length === 2)
  .map(([name, url]) => ({ name, url }));

function getJson(url, timeoutMs = 2000, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs, headers }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          if (res.statusCode && res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
          resolve(JSON.parse(body));
        } catch (e) { reject(e); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function crdtOverview() {
  const merged = new CrdtState("api");
  const nodes = await Promise.all(
    CRDT_PEERS.map(async ({ name, url }) => {
      try {
        const hdrs = CRDT_TOKEN ? { "x-crdt-token": CRDT_TOKEN } : {};
        const s = await getJson(`${url}/state`, 2000, hdrs);
        merged.merge(s);
        return { name, up: true, ips: Object.keys(s.ips || {}).length };
      } catch {
        return { name, up: false, ips: 0 };
      }
    })
  );
  const ips = Object.entries(merged.toJSON().ips)
    .map(([ip, r]) => ({
      ip,
      level: r.level,
      last_seen: r.last ? new Date(r.last.ts).toISOString() : null,
      last_decoy: r.last ? r.last.decoy : null,
      decoys: Object.keys(r.counts),
      total_events: Object.values(r.counts).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.level - a.level || String(b.last_seen).localeCompare(String(a.last_seen)))
    .slice(0, 200);
  return {
    nodes_total: nodes.length,
    nodes_up: nodes.filter((n) => n.up).length,
    nodes,
    ips_total: ips.length,
    ips,
  };
}

const MONGO_URL = process.env.MONGO_URL || "mongodb://mongodb:27017";
const PORT = Number(process.env.PORT || 3001);
const FILTERS = ["decoy", "src_ip", "protocol", "event_type", "session"];

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function top(events, queryFilter, field, n = 5) {
  return events
    .aggregate([
      { $match: { ...queryFilter, [field]: { $ne: null } } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: n },
      { $project: { _id: 0, value: "$_id", count: 1 } },
    ])
    .toArray();
}

function byDay(events, queryFilter, days) {
  const since = new Date(Date.now() - days * 86400000);
  return events
    .aggregate([
      { $match: { ...queryFilter, timestamp: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, day: "$_id", count: 1 } },
    ])
    .toArray();
}

function byDayDecoy(events, queryFilter, days) {
  const since = new Date(Date.now() - days * 86400000);
  return events
    .aggregate([
      { $match: { ...queryFilter, timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            decoy: "$decoy",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1 } },
      {
        $project: {
          _id: 0,
          day: "$_id.day",
          decoy: "$_id.decoy",
          count: 1,
        },
      },
    ])
    .toArray();
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooBig = false;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 10_000) {
        if (!tooBig) reject(new auth.HttpError(413, "body too large"));
        tooBig = true;
      } else chunks.push(c);
    });
    req.on("end", () => {
      if (tooBig) return;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        if (body === null || typeof body !== "object" || Array.isArray(body)) throw new Error();
        resolve(body);
      } catch {
        reject(new auth.HttpError(400, "body must be a JSON object"));
      }
    });
    req.on("error", reject);
  });
}

const dec = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    throw new auth.HttpError(400, "bad path");
  }
};

const bearer = (req) => {
  const m = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
  return m ? m[1] : null;
};

function buildServer(db) {
  const events = db.collection("events");

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      const method = req.method;

      if (path === "/health" && method === "GET") return send(res, 200, { ok: true });

      const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

      if (path === "/auth/login" && method === "POST") {
        auth.checkRateLimit("login", clientIp, 20, 60_000);
        const { username, password } = await readJson(req);
        const session = await auth.login(db, username, password);
        if (!session) return send(res, 401, { error: "invalid username or password" });
        return send(res, 200, session);
      }

      if (path === "/auth/signup" && method === "POST") {
        auth.checkRateLimit("signup", clientIp, 10, 300_000);
        const { username, password, reason } = await readJson(req);
        await auth.requestSignup(db, { username, password, reason });
        return send(res, 202, { ok: true });
      }

      const token = bearer(req);
      const user = token ? await auth.sessionUser(db, token) : null;
      if (!user) return send(res, 401, { error: "not signed in" });

      if (path === "/auth/me" && method === "GET") return send(res, 200, { user });

      if (path === "/auth/logout" && method === "POST") {
        await auth.logout(db, token);
        return send(res, 200, { ok: true });
      }

      if (path === "/auth/password" && method === "POST") {
        const { current, next } = await readJson(req);
        await auth.changePassword(db, user.username, token, current, next);
        return send(res, 200, { ok: true });
      }

      if (path === "/users" || path.startsWith("/users/")) {
        if (user.role !== "admin") return send(res, 403, { error: "admins only" });
        if (path === "/users" && method === "GET") return send(res, 200, await auth.listUsers(db));
        if (path === "/users" && method === "POST") {
          const { username, password, role } = await readJson(req);
          return send(res, 201, await auth.createUser(db, { username, password, role }));
        }
        if (path === "/users/requests" && method === "GET") return send(res, 200, await auth.listRequests(db));
        let m = /^\/users\/requests\/([^/]+)\/approve$/.exec(path);
        if (m && method === "POST") {
          const { role } = await readJson(req);
          return send(res, 200, await auth.approveRequest(db, user.username, dec(m[1]), role));
        }
        m = /^\/users\/requests\/([^/]+)$/.exec(path);
        if (m && method === "DELETE") {
          await auth.rejectRequest(db, user.username, dec(m[1]));
          return send(res, 200, { ok: true });
        }
        m = /^\/users\/([^/]+)\/role$/.exec(path);
        if (m && method === "POST") {
          const { role } = await readJson(req);
          return send(res, 200, await auth.setRole(db, user.username, dec(m[1]), role));
        }
        if (path.startsWith("/users/") && method === "DELETE") {
          await auth.deleteUser(db, user.username, dec(path.slice(7)));
          return send(res, 200, { ok: true });
        }
        return send(res, 405, { error: "method not allowed" });
      }
      if (path === "/reports" || path.startsWith("/reports/")) {
        const reports = db.collection("reports");
        if (path === "/reports" && method === "GET") {
          return send(res, 200, await reports.find({}).sort({ created_at: -1 }).limit(100).toArray());
        }
        if (path === "/reports" && method === "POST") {
          auth.checkRateLimit("reports", user.username, 20, 60_000);
          const b = await readJson(req);
          const title = String(b.title || "").trim().slice(0, 120);
          const notes = String(b.notes || "").trim().slice(0, 4000);
          const severity = ["low", "medium", "high"].includes(b.severity) ? b.severity : null;
          const src_ip = String(b.src_ip || "").trim().slice(0, 64);
          if (!title || !notes || !severity) {
            return send(res, 400, { error: "title, notes and severity are required" });
          }
          const doc = {
            _id: require("crypto").randomUUID(),
            title,
            notes,
            severity,
            src_ip: src_ip || null,
            author: user.username,
            created_at: new Date(),
          };
          await reports.insertOne(doc);
          return send(res, 201, doc);
        }
        const rm = /^\/reports\/([^/]+)$/.exec(path);
        if (rm && method === "DELETE") {
          if (user.role !== "admin") return send(res, 403, { error: "admins only" });
          await reports.deleteOne({ _id: dec(rm[1]) });
          return send(res, 200, { ok: true });
        }
        return send(res, 405, { error: "method not allowed" });
      }
      if (method !== "GET") return send(res, 405, { error: "method not allowed" });

      if (path === "/audit") {
        if (user.role !== "admin") return send(res, 403, { error: "admins only" });
        return send(res, 200, await auth.listAudit(db));
      }
      if (path === "/crdt") return send(res, 200, await crdtOverview());
      const isDemo = url.searchParams.get("data") === "demo";
      const baseFilter = isDemo ? { synthetic: true } : { synthetic: { $ne: true } };
            if (path === "/stream") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });
        res.write("retry: 3000\n\n");

        const WINDOW_MS = 60_000;
        const seen = new Map();
        let decisionTs = new Date();
        let first = true;
        let busy = false;
        let n = 0;
        const push = (type, doc) => res.write(`event: ${type}\ndata: ${JSON.stringify(doc)}\n\n`);

        const tick = async () => {
          if (busy) return;
          busy = true;
          try {
            const cutoff = new Date(Date.now() - WINDOW_MS);
            const evs = await events
              .find({ synthetic: { $ne: true }, timestamp: { $gte: cutoff } }, { projection: { raw: 0 } })
              .sort({ timestamp: 1 })
              .limit(200)
              .toArray();
            for (const e of evs) {
              const id = String(e._id);
              if (seen.has(id)) continue;
              seen.set(id, e.timestamp.getTime());
              if (!first) push("event", e);
            }
            for (const [id, ts] of seen) if (ts < cutoff.getTime()) seen.delete(id);

            const decs = await db
              .collection("adaptive_decisions")
              .find({ synthetic: { $ne: true }, timestamp: { $gt: decisionTs } })
              .sort({ timestamp: 1 })
              .limit(50)
              .toArray();
            for (const d of decs) {
              push("decision", {
                _id: d._id,
                timestamp: d.timestamp,
                src_ip: d.src_ip,
                session: d.session,
                action: d.action,
                fallback: d.fallback,
              });
              decisionTs = d.timestamp;
            }
            first = false;
            if (++n % 7 === 0) res.write(": ping\n\n");
          } catch (err) {
            console.error(`stream: ${err.message}`);
          } finally {
            busy = false;
          }
        };

        tick();
        const timer = setInterval(tick, 2000);
        req.on("close", () => clearInterval(timer));
        return;
      }
      if (path === "/adaptive/decisions" && method === "GET") {
        const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
        const docs = await db.collection("adaptive_decisions").find(baseFilter).sort({ timestamp: -1 }).limit(limit).toArray();
        return send(res, 200, docs);
      }
      if (path === "/adaptive/stats" && method === "GET") {
        const total = await db.collection("adaptive_decisions").countDocuments(baseFilter);
        const actions = await db.collection("adaptive_decisions").aggregate([
          { $match: baseFilter },
          { $group: { _id: "$action", count: { $sum: 1 } } }
        ]).toArray();
        const actionCounts = { maintain: 0, escalate_tier: 0, plant_breadcrumb: 0, observe_only: 0 };
        for (const a of actions) {
          if (a._id in actionCounts) actionCounts[a._id] = a.count;
        }
        const phases = await db.collection("adaptive_decisions").aggregate([
          { $match: baseFilter },
          { $group: { _id: { $ifNull: ["$phase", "final"] }, count: { $sum: 1 } } }
        ]).toArray();
        const phaseCounts = { live: 0, final: 0 };
        for (const p of phases) {
          if (p._id in phaseCounts) phaseCounts[p._id] = p.count;
        }
        const liveLatDocs = await db.collection("adaptive_decisions").find(
          { ...baseFilter, phase: "live", latency_ms: { $type: "number" } },
          { projection: { latency_ms: 1 } }
        ).toArray();
        const lats = liveLatDocs.map((d) => d.latency_ms).sort((a, b) => a - b);
        const pct = (arr, q) => {
          if (!arr.length) return null;
          const idx = Math.min(arr.length - 1, Math.max(0, Math.floor(q * (arr.length - 1))));
          return arr[idx];
        };
        const fallbackCount = await db.collection("adaptive_decisions").countDocuments({ ...baseFilter, fallback: true });
        const latest = await db.collection("adaptive_decisions").findOne(baseFilter, { sort: { timestamp: -1 } });
        return send(res, 200, {
          total,
          by_action: actionCounts,
          by_phase: phaseCounts,
          live_latency_ms: {
            count: lats.length,
            median: pct(lats, 0.5),
            p95: pct(lats, 0.95),
          },
          fallback_count: fallbackCount,
          latest_decision: latest ? latest.timestamp : null,
        });
      }

      if (path === "/events") {
        const filter = { ...baseFilter };
        for (const key of FILTERS) {
          const v = url.searchParams.get(key);
          if (v) filter[key] = String(v);
        }
        const since = url.searchParams.get("since");
        if (since) {
          const d = new Date(since);
          if (isNaN(d)) return send(res, 400, { error: "bad 'since' date" });
          filter.timestamp = { $gte: d };
        }
        const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
        const docs = await events
          .find(filter, { projection: { raw: 0 } })
          .sort({ timestamp: -1 })
          .limit(limit)
          .toArray();
        return send(res, 200, docs);
      }

      if (path === "/stats") {
        const statDays = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365);
        return send(res, 200, {
          total: await events.countDocuments(baseFilter),
          by_decoy: await top(events, baseFilter, "decoy", 10),
          by_event_type: await top(events, baseFilter, "event_type", 10),
          top_src_ip: await top(events, baseFilter, "src_ip"),
          top_usernames: await top(events, baseFilter, "username"),
          top_passwords: await top(events, baseFilter, "password"),
          top_commands: await top(events, baseFilter, "command"),
          by_day: await byDay(events, baseFilter, statDays),
          by_day_decoy: await byDayDecoy(events, baseFilter, statDays),
        });
      }

      if (path === "/attackers") {
        const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
        const pipeline = [{ $match: baseFilter }, ...attackersPipeline(limit)];
        const docs = await events.aggregate(pipeline).toArray();
        return send(res, 200, docs.map(shapeAttacker));
      }

      if (path.startsWith("/attackers/")) {
        const ip = decodeURIComponent(path.slice(11));
        if (!ip) return send(res, 400, { error: "missing IP" });
        const filter = { ...baseFilter, src_ip: ip };
        const pipeline = [{ $match: filter }, ...attackersPipeline(1)];
        const docs = await events.aggregate(pipeline).toArray();
        if (!docs.length) return send(res, 404, { error: "attacker not found" });
        return send(res, 200, shapeAttacker(docs[0]));
      }

      if (path === "/honeytokens") {
        const tokens = loadHoneytokens();
        const hits = await db.collection("honeytoken_hits").find({}).sort({ timestamp: -1 }).limit(100).toArray();
        const counts = new Map();
        const lastHitByToken = new Map();
        for (const h of hits) {
          counts.set(h.token_id, (counts.get(h.token_id) || 0) + 1);
          if (!lastHitByToken.has(h.token_id)) lastHitByToken.set(h.token_id, h);
        }
        return send(res, 200, {
          tokens: tokens.map((t) => ({
            id: t.id,
            kind: t.kind,
            username: t.username,
            planted_in: t.planted_in,
            usable_on: t.usable_on || [],
            hit_count: counts.get(t.id) || 0,
            hit: (counts.get(t.id) || 0) > 0,
            last_hit: lastHitByToken.get(t.id) || null,
          })),
          recent_hits: hits.slice(0, 20),
        });
      }

      if (path === "/ops") {
        const totalDecisions = await db.collection("adaptive_decisions").countDocuments({});
        const fallbackCount = await db.collection("adaptive_decisions").countDocuments({ fallback: true });
        const liveLatDocs = await db.collection("adaptive_decisions").find(
          { phase: "live", latency_ms: { $type: "number" } },
          { projection: { latency_ms: 1 } }
        ).toArray();
        const lats = liveLatDocs.map((d) => d.latency_ms).sort((a, b) => a - b);
        const pct = (arr, q) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(q * (arr.length - 1)))] : null);
        const sources = await db.collection("collector_status").find({}).toArray();
        const crdt = await crdtOverview();
        let sidecar = { status: "unreachable", model_loaded: false };
        try {
          sidecar = await getJson(`${SIDECAR_URL}/health`, 1500);
        } catch { /* unreachable */ }
        const backupMeta = await db.collection("ops_meta").findOne({ _id: "last_backup" });
        const lastBackupAgeSec = backupMeta?.timestamp
          ? Math.round((Date.now() - new Date(backupMeta.timestamp).getTime()) / 1000)
          : null;
        return send(res, 200, {
          decision_latency_ms: { count: lats.length, median: pct(lats, 0.5), p95: pct(lats, 0.95) },
          fallback_rate: totalDecisions > 0 ? Number((fallbackCount / totalDecisions).toFixed(4)) : 0,
          total_decisions: totalDecisions,
          fallback_count: fallbackCount,
          collector_sources: sources.map((s) => ({
            decoy: s.decoy,
            offset: s.offset,
            last_poll_at: s.last_poll_at,
            last_event_at: s.last_event_at || null,
            lag_s: s.last_poll_at ? Math.round((Date.now() - new Date(s.last_poll_at).getTime()) / 1000) : null,
          })),
          sidecar,
          crdt,
          last_backup_at: backupMeta?.timestamp || null,
          last_backup_age_s: lastBackupAgeSec,
        });
      }

      if (path === "/sessions") {
        const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
        const pipeline = [{ $match: baseFilter }, ...sessionsPipeline(limit)];
        const docs = await events.aggregate(pipeline).toArray();
        const ids = docs.map((d) => d._id);
        const metas = await db.collection("session_meta").find({ _id: { $in: ids } }).toArray();
        const metaMap = new Map(metas.map((m) => [m._id, m]));
        return send(res, 200, docs.map((d) => {
          const shaped = shapeSession(d);
          const m = metaMap.get(d._id);
          if (m) {
            shaped.actor = { actor_type: m.actor_type, confidence: m.confidence, reasons: m.reasons, skill_level: m.skill_level };
            shaped.arm = m.arm || null;
          }
          return shaped;
        }));
      }

      if (path.startsWith("/sessions/")) {
        const sessionId = decodeURIComponent(path.slice(10));
        if (!sessionId) return send(res, 400, { error: "missing session id" });
        const filter = { ...baseFilter, session: sessionId };
        const pipeline = [{ $match: filter }, ...sessionsPipeline(1)];
        const docs = await events.aggregate(pipeline).toArray();
        if (!docs.length) return send(res, 404, { error: "session not found" });
        const shaped = shapeSession(docs[0]);
        const m = await db.collection("session_meta").findOne({ _id: sessionId });
        if (m) {
          shaped.actor = { actor_type: m.actor_type, confidence: m.confidence, reasons: m.reasons, skill_level: m.skill_level };
          shaped.arm = m.arm || null;
        }
        return send(res, 200, shaped);
      }

      send(res, 404, { error: "not found" });
    } catch (err) {
      if (err instanceof auth.HttpError) {
        if (err.status === 413) res.once("finish", () => req.destroy());
        return send(res, err.status, { error: err.message });
      }
      console.error(err.message);
      send(res, 500, { error: "internal error" });
    }
  });
}

async function main() {
  let client, db;
  try {
    client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 2000 });
    await client.connect();
    db = client.db("honeynet");
    await auth.ensureIndexes(db);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.warn("MongoDB connection failed, falling back to in-memory mock database:", err.message);
    client = new MemoryMongoClient();
    await client.connect();
    db = client.db("honeynet");
    await seedMemoryDb(db);
  }
  buildServer(db).listen(PORT, '0.0.0.0', () => console.log(`api listening on ${PORT}`));
}

if (require.main === module) main();

module.exports = { buildServer };

