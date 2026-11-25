const fs = require("fs");
const http = require("http");
const { mapAttack } = require("./mitre");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
const { parseCsvLine } = require("./records");
const { evaluateAndDecide } = require("./adaptive");

let db = null;

const MONGO_URL = process.env.MONGO_URL || "mongodb://mongodb:27017";
const LOG_DIR = process.env.LOG_DIR || "/logs";
const ACTUATOR_URL = process.env.ACTUATOR_URL || "http://cowrie-actuator:7100";
const LIVE_ACTIONS_ENABLED = process.env.LIVE_ACTIONS !== "0";
const LIVE_COOLDOWN_MS = 2000;

const SOURCES = [
  { decoy: "cowrie", file: "cowrie/cowrie.json", format: "jsonl", pollMs: 1000, normalize: require("./normalizers/cowrie") },
  { decoy: "web-portal", file: "web-portal/web.json", format: "jsonl", pollMs: 5000, normalize: require("./normalizers/web-portal") },
  { decoy: "heralding", file: "heralding/auth.csv", format: "csv", pollMs: 5000, normalize: require("./normalizers/heralding") },
  { decoy: "dionaea", file: "dionaea/lib/dionaea/dionaea.json", format: "jsonl", pollMs: 5000, normalize: require("./normalizers/dionaea") },
].map((s) => ({ ...s, offset: 0, header: null, nextPollAt: 0 }));

const liveSeqBySession = new Map();

function postActuation({ session, action, seq }) {
  return new Promise((resolve) => {
    try {
      const url = new URL("/action", ACTUATOR_URL);
      const payload = JSON.stringify({ session, action, seq });
      const req = http.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
          timeout: 1500,
        },
        (res) => {
          res.resume();
          resolve(res.statusCode >= 200 && res.statusCode < 300);
        }
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.write(payload);
      req.end();
    } catch {
      resolve(false);
    }
  });
}

function toRecord(src, line) {
  if (src.format === "jsonl") return JSON.parse(line);
  if (!src.header) {
    src.header = parseCsvLine(line);
    return null;
  }
  const values = parseCsvLine(line);
  return Object.fromEntries(src.header.map((h, i) => [h, values[i] ?? ""]));
}

async function decideForClosedSessions(docs) {
  for (const d of docs) {
    if (d.event_type !== "session_end" || !d.session) continue;
    try {
      const done = await db
        .collection("adaptive_decisions")
        .findOne({ session: d.session, phase: "final" }, { projection: { _id: 1 } });
      if (done) continue;
      const decision = await evaluateAndDecide(db, {
        session: d.session,
        src_ip: d.src_ip,
        phase: "final",
        seq: null,
        latency_ms: null,
      });
      liveSeqBySession.delete(d.session);
      console.log(`adaptive: final session ${d.session} -> ${decision.action}`);
    } catch (err) {
      console.error(`adaptive: ${err.message}`);
    }
  }
}

async function decideLive(session, newestCmdTs) {
  if (!session) return;
  const closed = await db
    .collection("events")
    .findOne({ session, event_type: "session_end" }, { projection: { _id: 1 } });
  if (closed) return;

  const lastLive = await db
    .collection("adaptive_decisions")
    .findOne({ session, phase: "live" }, { sort: { timestamp: -1 } });

  const nowMs = Date.now();
  if (lastLive && nowMs - new Date(lastLive.timestamp).getTime() <= LIVE_COOLDOWN_MS) {
    return;
  }

  const prevSeq = liveSeqBySession.get(session) ?? (lastLive?.seq ?? 0);
  const seq = prevSeq + 1;
  liveSeqBySession.set(session, seq);

  const cmdMs = newestCmdTs ? new Date(newestCmdTs).getTime() : nowMs;
  const latency_ms = Math.max(0, nowMs - cmdMs);

  const decision = await evaluateAndDecide(db, {
    session,
    phase: "live",
    seq,
    latency_ms,
  });

  if (LIVE_ACTIONS_ENABLED) {
    await postActuation({ session, action: decision.action, seq });
  }

  console.log(`adaptive: live session ${session} seq=${seq} -> ${decision.action} (latency=${latency_ms}ms)`);
}

async function decideForLiveCommands(src, docs) {
  if (src.decoy !== "cowrie") return;
  const latestBySession = new Map();
  for (const d of docs) {
    if (d.event_type === "command" && d.session) {
      const ts = new Date(d.timestamp).getTime();
      const prev = latestBySession.get(d.session);
      if (!prev || ts >= prev) latestBySession.set(d.session, ts);
    }
  }
  for (const [session, newestCmdTs] of latestBySession.entries()) {
    try {
      await decideLive(session, newestCmdTs);
    } catch (err) {
      console.error(`adaptive live: ${err.message}`);
    }
  }
}

async function poll(src, events) {
  const path = `${LOG_DIR}/${src.file}`;
  let size;
  try { size = fs.statSync(path).size; } catch { return; }
  if (size < src.offset) { src.offset = 0; src.header = null; }
  if (size === src.offset) return;

  const buf = Buffer.alloc(size - src.offset);
  const fd = fs.openSync(path, "r");
  fs.readSync(fd, buf, 0, buf.length, src.offset);
  fs.closeSync(fd);

  const text = buf.toString("utf8");
  const end = text.lastIndexOf("\n");
  if (end === -1) return;
  src.offset += Buffer.byteLength(text.slice(0, end + 1));

  const docs = [];
  let bad = 0;
  for (const line of text.slice(0, end).split(/\r?\n/).filter(Boolean)) {
    try {
      const rec = toRecord(src, line);
      if (!rec) continue;
      const n = src.normalize(rec);
      if (!n) continue;
      n.attack = mapAttack(n);
      const _id = crypto.createHash("sha1").update(`${src.decoy}\n${line}`).digest("hex");
      docs.push({ _id, ...n, timestamp: new Date(n.timestamp) });
    } catch {
      bad++;
    }
  }

  if (docs.length > 0) {
    await events.bulkWrite(
      docs.map(({ _id, ...d }) => ({ updateOne: { filter: { _id }, update: { $set: d }, upsert: true } })),
      { ordered: false }
    );
    await decideForLiveCommands(src, docs);
    await decideForClosedSessions(docs);
  }
  console.log(`${src.decoy}: ${docs.length} events processed, ${bad} unparseable`);
}

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db("honeynet");
  const events = db.collection("events");
  await events.createIndex({ timestamp: 1 });
  await events.createIndex({ src_ip: 1 });
  await events.createIndex({ session: 1 });
  await db.collection("adaptive_decisions").createIndex({ session: 1, phase: 1, timestamp: -1 });
  console.log("collector started");
  for (;;) {
    const now = Date.now();
    for (const src of SOURCES) {
      if (now < src.nextPollAt) continue;
      src.nextPollAt = now + (src.pollMs || 5000);
      try { await poll(src, events); } catch (err) { console.error(`${src.decoy}: ${err.message}`); }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
})();