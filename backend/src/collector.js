const fs = require("fs");
const { mapAttack } = require("./mitre");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
const { parseCsvLine } = require("./records");

const MONGO_URL = process.env.MONGO_URL || "mongodb://mongodb:27017";
const LOG_DIR = process.env.LOG_DIR || "/logs";
const POLL_MS = 5000;

const SOURCES = [
  { decoy: "cowrie", file: "cowrie/cowrie.json", format: "jsonl", normalize: require("./normalizers/cowrie") },
  { decoy: "web-portal", file: "web-portal/web.json", format: "jsonl", normalize: require("./normalizers/web-portal") },
  { decoy: "heralding", file: "heralding/auth.csv", format: "csv", normalize: require("./normalizers/heralding") },
  { decoy: "dionaea", file: "dionaea/lib/dionaea/dionaea.json", format: "jsonl", normalize: require("./normalizers/dionaea") },
].map((s) => ({ ...s, offset: 0, header: null }));

function toRecord(src, line) {
  if (src.format === "jsonl") return JSON.parse(line);
  if (!src.header) {
    src.header = parseCsvLine(line);
    return null;
  }
  const values = parseCsvLine(line);
  return Object.fromEntries(src.header.map((h, i) => [h, values[i] ?? ""]));
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
}
  console.log(`${src.decoy}: ${docs.length} events processed, ${bad} unparseable`);
}

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const events = client.db("honeynet").collection("events");
  await events.createIndex({ timestamp: 1 });
  await events.createIndex({ src_ip: 1 });
  await events.createIndex({ session: 1 });
  console.log("collector started");
  for (;;) {
    for (const src of SOURCES) {
      try { await poll(src, events); } catch (err) { console.error(`${src.decoy}: ${err.message}`); }
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
})();