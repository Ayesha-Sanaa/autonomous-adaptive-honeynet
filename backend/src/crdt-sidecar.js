const fs = require("fs");
const http = require("http");
const { CrdtState } = require("./crdt");
const { parseCsvLine } = require("./records");

const NODE = process.env.DECOY_NAME || "node";
const PORT = Number(process.env.PORT || 7000);
const LOG_FILE = process.env.LOG_FILE || "";
const FORMAT = process.env.LOG_FORMAT || "jsonl";
const NORMALIZER = process.env.NORMALIZER || "";
const SYNC_MS = Number(process.env.SYNC_MS || 3000);
const POLL_MS = Number(process.env.POLL_MS || 2000);
const PEERS = (process.env.PEERS || "").split(",").map((s) => s.trim()).filter(Boolean);

const state = new CrdtState(NODE);
const normalize = NORMALIZER ? require(`./normalizers/${NORMALIZER}`) : null;
let offset = 0;
let header = null;

function levelOf(n) {
  if (n.event_type === "command") return 4;
  if (n.event_type === "login_attempt") return n.success === true ? 3 : 2;
  return 1;
}

function tail() {
  if (!LOG_FILE || !normalize) return;
  let size;
  try { size = fs.statSync(LOG_FILE).size; } catch { return; }
  if (size < offset) { offset = 0; header = null; }
  if (size === offset) return;
  const buf = Buffer.alloc(size - offset);
  const fd = fs.openSync(LOG_FILE, "r");
  fs.readSync(fd, buf, 0, buf.length, offset);
  fs.closeSync(fd);
  const text = buf.toString("utf8");
  const end = text.lastIndexOf("\n");
  if (end === -1) return;
  offset += Buffer.byteLength(text.slice(0, end + 1));
  for (const line of text.slice(0, end).split(/\r?\n/).filter(Boolean)) {
    try {
      let rec;
      if (FORMAT === "jsonl") rec = JSON.parse(line);
      else if (!header) { header = parseCsvLine(line); continue; }
      else {
        const v = parseCsvLine(line);
        rec = Object.fromEntries(header.map((h, i) => [h, v[i] ?? ""]));
      }
      const n = normalize(rec);
      if (!n || !n.src_ip) continue;
      state.observe(n.src_ip, {
        level: levelOf(n),
        ts: new Date(n.timestamp).getTime() || Date.now(),
        decoy: NODE,
      });
    } catch { /* skip bad line */ }
  }
}

function pullPeer(url) {
  return new Promise((resolve) => {
    const req = http.get(`${url}/state`, { timeout: 2000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { state.merge(JSON.parse(body)); } catch { /* ignore */ }
        resolve();
      });
    });
    req.on("timeout", () => { req.destroy(); resolve(); });
    req.on("error", () => resolve());
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve(null); } });
  });
}

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  if (req.method === "GET" && req.url === "/health") return send(200, { status: "ok", node: NODE });
  if (req.method === "GET" && req.url === "/state") return send(200, state.toJSON());
  if (req.method === "POST" && req.url === "/merge") {
    const body = await readBody(req);
    if (!body) return send(400, { error: "bad json" });
    state.merge(body);
    return send(200, { ok: true });
  }
  if (req.method === "POST" && req.url === "/observe") {
    const body = await readBody(req);
    if (!body || !body.ip) return send(400, { error: "ip required" });
    state.observe(body.ip, { level: body.level || 1, ts: body.ts || Date.now(), decoy: NODE });
    return send(200, { ok: true });
  }
  send(404, { error: "not found" });
});

server.listen(PORT, () => console.log(`crdt sidecar ${NODE} on ${PORT}, peers: ${PEERS.join(",") || "none"}`));
setInterval(tail, POLL_MS);
setInterval(() => { PEERS.forEach((p) => pullPeer(p)); }, SYNC_MS);