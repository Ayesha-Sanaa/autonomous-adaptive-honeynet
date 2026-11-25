const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.ACTUATOR_PORT || 7100);
const ACTIONS_DIR = process.env.ACTIONS_DIR || "/actions";
const ALLOWED = ["maintain", "escalate_tier", "plant_breadcrumb", "observe_only"];

fs.mkdirSync(ACTIONS_DIR, { recursive: true });

function safeSessionId(raw) {
  const s = String(raw ?? "").replace(/[^a-zA-Z0-9._-]/g, "_");
return (s || "unknown").slice(0, 64);}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === "POST" && req.url === "/action") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 65536) req.destroy();
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}");
        if (!parsed.session || !parsed.action) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "session and action are required" }));
        }
        if (!ALLOWED.includes(String(parsed.action))) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "action not allowed" }));
        }
        const filePath = path.join(ACTIONS_DIR, `${safeSessionId(parsed.session)}.json`);
        const record = {
          session: String(parsed.session),
          action: String(parsed.action),
          seq: parsed.seq ?? null,
          updated_at: new Date().toISOString(),
        };
        fs.writeFileSync(filePath, JSON.stringify(record) + "\n", "utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, file: filePath }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`cowrie-actuator listening on :${PORT}, dir=${ACTIONS_DIR}`);
});