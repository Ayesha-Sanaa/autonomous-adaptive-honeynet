const fs = require("fs");
const http = require("http");
const path = require("path");
const { mapAttack } = require("./mitre");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
const { parseCsvLine } = require("./records");
const { evaluateAndDecide } = require("./adaptive");
const { matchHoneytoken } = require("./honeytokens");
const { classifySession } = require("./actor");

let db = null;

const MONGO_URL = process.env.MONGO_URL || "mongodb://mongodb:27017";
const LOG_DIR = process.env.LOG_DIR || "/logs";
const ACTUATOR_URL = process.env.ACTUATOR_URL || "http://cowrie-actuator:7100";
const LIVE_ACTIONS_ENABLED = process.env.LIVE_ACTIONS !== "0";
const LIVE_COOLDOWN_MS = 2000;
const OFFSETS_FILE = process.env.OFFSETS_FILE || `${LOG_DIR}/.collector-offsets.json`;
const EXPERIMENT_MODE = process.env.EXPERIMENT_MODE === "1";
const EXPERIMENT_ARMS = (process.env.EXPERIMENT_ARMS || "A_maintain,B_fixed_rule,C_ppo")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SOURCES = [
  { decoy: "cowrie", file: "cowrie/cowrie.json", format: "jsonl", pollMs: 1000, normalize: require("./normalizers/cowrie") },
  { decoy: "cowrie-actuation", file: "cowrie/actuation.json", format: "jsonl", pollMs: 1000, normalize: require("./normalizers/cowrie-actuation") },
  { decoy: "web-portal", file: "web-portal/web.json", format: "jsonl", pollMs: 5000, normalize: require("./normalizers/web-portal") },
  { decoy: "heralding", file: "heralding/auth.csv", format: "csv", pollMs: 5000, normalize: require("./normalizers/heralding") },
  { decoy: "dionaea", file: "dionaea/lib/dionaea/dionaea.json", format: "jsonl", pollMs: 5000, normalize: require("./normalizers/dionaea") },
  { decoy: "mariadb", file: "mariadb/general.log", format: "line", pollMs: 5000, normalize: require("./normalizers/mariadb") },
].map((s) => ({ ...s, offset: 0, header: null, nextPollAt: 0 }));

const liveSeqBySession = new Map();

function loadOffsets() {
  try {
    if (!fs.existsSync(OFFSETS_FILE)) return;
    const saved = JSON.parse(fs.readFileSync(OFFSETS_FILE, "utf8"));
    for (const s of SOURCES) {
      if (saved[s.file] && typeof saved[s.file].offset === "number") {
        s.offset = saved[s.file].offset;
        s.header = saved[s.file].header || null;
      }
    }
    console.log("collector: restored read offsets");
  } catch (err) {
    console.warn("collector: could not load offsets:", err.message);
  }
}

function saveOffsets() {
  try {
    const out = {};
    for (const s of SOURCES) {
      out[s.file] = { offset: s.offset, header: s.header };
    }
    fs.mkdirSync(path.dirname(OFFSETS_FILE), { recursive: true });
    fs.writeFileSync(OFFSETS_FILE, JSON.stringify(out), "utf8");
  } catch {
    // Host mount may be read-only in some setups; ignore cleanly
  }
}

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
  if (src.format === "line") return line;
  if (!src.header) {
    src.header = parseCsvLine(line);
    return null;
  }
  const values = parseCsvLine(line);
  return Object.fromEntries(src.header.map((h, i) => [h, values[i] ?? ""]));
}

async function ensureSessionMeta(session, srcIp) {
  if (!session) return { skill_level: "high", arm: "C_ppo" };
  const metaCol = db.collection("session_meta");
  const existing = await metaCol.findOne({ _id: session });
  const events = await db.collection("events").find({ session }).sort({ timestamp: 1 }).toArray();
  const actor = classifySession(events);
  const arm = existing?.arm || (
    EXPERIMENT_MODE && EXPERIMENT_ARMS.length > 0
      ? EXPERIMENT_ARMS[crypto.randomInt(0, EXPERIMENT_ARMS.length)]
      : "C_ppo"
  );
  await metaCol.updateOne(
    { _id: session },
    {
      $set: {
        session,
        src_ip: srcIp || events[0]?.src_ip || existing?.src_ip || null,
        ...actor,
        arm,
        updated_at: new Date(),
      },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true }
  );
  return { ...actor, arm };
}

async function processActuationEvents(docs) {
  const decisions = db.collection("adaptive_decisions");
  for (const d of docs) {
    if (d.event_type !== "actuation_applied" || !d.session) continue;
    const filter = { session: d.session, phase: "live" };
    if (d.seq != null) filter.seq = d.seq;
    await decisions.updateOne(
      filter,
      {
        $set: {
          "applied_action.verified": Boolean(d.verified),
          "applied_action.applied_at": d.timestamp,
          "applied_action.effect": d.effect || {},
        },
      },
      { sort: { timestamp: -1 } }
    );
  }
}

async function recordHoneytokenHits(docs) {
  const hitsCol = db.collection("honeytoken_hits");
  for (const d of docs) {
    if (!d.honeytoken) continue;
    await hitsCol.updateOne(
      { event_id: d._id },
      {
        $setOnInsert: {
          event_id: d._id,
          token_id: d.honeytoken.id,
          planted_in: d.honeytoken.planted_in,
          matched_field: d.honeytoken.matched_field,
          severity: "high",
          src_ip: d.src_ip || null,
          decoy: d.decoy,
          event_type: d.event_type,
          session: d.session || null,
          timestamp: d.timestamp,
        },
      },
      { upsert: true }
    );
  }
}

async function decideForClosedSessions(docs) {
  for (const d of docs) {
    if (d.event_type !== "session_end" || !d.session) continue;
    try {
      const meta = await ensureSessionMeta(d.session, d.src_ip);
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
        skill_level: meta.skill_level,
        arm: meta.arm,
      });
      liveSeqBySession.delete(d.session);
      console.log(`adaptive: final session ${d.session} arm=${meta.arm} -> ${decision.action}`);
    } catch (err) {
      console.error(`adaptive: ${err.message}`);
    }
  }
}

async function decideLive(session, newestCmdTs, srcIp) {
  if (!session) return;
  const closed = await db
    .collection("events")
    .findOne({ session, event_type: "session_end" }, { projection: { _id: 1 } });
  if (closed) return;

  const meta = await ensureSessionMeta(session, srcIp);
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
    src_ip: srcIp,
    phase: "live",
    seq,
    latency_ms,
    skill_level: meta.skill_level,
    arm: meta.arm,
  });

  if (LIVE_ACTIONS_ENABLED) {
    await postActuation({ session, action: decision.action, seq });
  }

  console.log(`adaptive: live session ${session} seq=${seq} arm=${meta.arm} skill=${meta.skill_level} -> ${decision.action} (latency=${latency_ms}ms)`);
}

async function decideForLiveCommands(src, docs) {
  if (src.decoy !== "cowrie") return;
  const latestBySession = new Map();
  for (const d of docs) {
    if (d.event_type === "command" && d.session) {
      const ts = new Date(d.timestamp).getTime();
      const prev = latestBySession.get(d.session);
      if (!prev || ts >= prev.ts) latestBySession.set(d.session, { ts, src_ip: d.src_ip });
    }
  }
  for (const [session, info] of latestBySession.entries()) {
    try {
      await decideLive(session, info.ts, info.src_ip);
    } catch (err) {
      console.error(`adaptive live: ${err.message}`);
    }
  }
}

async function poll(src, events) {
  const logPath = `${LOG_DIR}/${src.file}`;
  let size;
  try { size = fs.statSync(logPath).size; } catch { return; }
  if (size < src.offset) { src.offset = 0; src.header = null; }
  if (size === src.offset) return;

  const buf = Buffer.alloc(size - src.offset);
  const fd = fs.openSync(logPath, "r");
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
      const ht = matchHoneytoken(n);
      if (ht) n.honeytoken = ht;
      const _id = crypto.createHash("sha1").update(`${src.decoy}\n${line}`).digest("hex");
      docs.push({ _id, ...n, timestamp: new Date(n.timestamp) });
    } catch {
      bad++;
    }
  }

  if (docs.length > 0) {
    if (src.decoy === "cowrie-actuation") {
      await processActuationEvents(docs);
    } else {
      await events.bulkWrite(
        docs.map(({ _id, ...d }) => ({ updateOne: { filter: { _id }, update: { $set: d }, upsert: true } })),
        { ordered: false }
      );
      await recordHoneytokenHits(docs);
      const touchedSessions = new Set(docs.map((d) => d.session).filter(Boolean));
      for (const s of touchedSessions) {
        const sample = docs.find((d) => d.session === s);
        await ensureSessionMeta(s, sample?.src_ip);
      }
      await decideForLiveCommands(src, docs);
      await decideForClosedSessions(docs);
    }
    saveOffsets();
  }

  await db.collection("collector_status").updateOne(
    { _id: src.decoy },
    {
      $set: {
        decoy: src.decoy,
        file: src.file,
        offset: src.offset,
        last_poll_at: new Date(),
        ...(docs.length > 0 ? { last_event_at: docs[docs.length - 1].timestamp } : {}),
      },
    },
    { upsert: true }
  );

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
  await db.collection("honeytoken_hits").createIndex({ timestamp: -1 });
  await db.collection("adaptive_decisions").updateMany(
    { phase: { $exists: false } },
    { $set: { phase: "final", seq: null, latency_ms: null } }
  );
  loadOffsets();
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