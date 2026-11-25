const http = require("http");
const fs = require("fs");
const crypto = require("crypto");

const LOG_FILE = process.env.WEB_LOG_FILE || "/logs/web.json";
const TOKEN_PATHS = [
  "/tokens/honeytokens.json",
  "/app/honeytokens.json",
  "/decoys/honeytokens.json",
];

function loadTokens() {
  for (const p of TOKEN_PATHS) {
    try {
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
        return parsed.tokens || [];
      }
    } catch { /* try next */ }
  }
  return [];
}

// Weak credentials matching Cowrie userdb + STORY.md staff
const VALID_ACCOUNTS = {
  admin: "admin",
  root: "toor",
  ubuntu: "ubuntu",
  pi: "raspberry",
  user: "user123",
  test: "test123",
  priya: "AlderFin#2024Nov",
  omar: "Welcome1",
  lena: "Admin123",
  sam: "P@ssw0rd",
};

const sessions = new Map();
const failState = new Map(); // ip -> { count, lockedUntil }
const MAX_FAILS = 5;
const LOCK_MS = 120_000;

function logEvent(ev) {
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(ev) + "\n");
  } catch (err) {
    console.error("web log write failed:", err.message);
  }
}

function getIp(req) {
  return req.headers["x-real-ip"] || req.socket.remoteAddress || "unknown";
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function portalToken() {
  const tokens = loadTokens();
  const t = tokens.find((x) => x.id === "ht-portal-dl-03");
  return t || { id: "ht-portal-dl-03", username: "priya", value: "AlderFin#2024Nov" };
}

function loginPage(errorMsg = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Alder Freight Ltd - Inventory Portal (web01)</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f2f4f7; color: #1f2937; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .box { background: #fff; padding: 28px; border-radius: 6px; width: 320px; border: 1px solid #d1d5db; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
    h2 { margin: 0 0 4px; font-size: 18px; }
    p.sub { margin: 0 0 18px; font-size: 12px; color: #6b7280; }
    input { width: 100%; padding: 9px; margin: 7px 0; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 4px; }
    button { width: 100%; padding: 10px; margin-top: 6px; background: #1e40af; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
    .err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 8px 10px; border-radius: 4px; font-size: 13px; margin-bottom: 12px; }
    .foot { margin-top: 14px; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Alder Freight Ltd</h2>
    <p class="sub">Internal Inventory &amp; Dispatch Portal &middot; web01</p>
    ${errorMsg ? `<div class="err">${errorMsg}</div>` : ""}
    <form method="POST" action="/login">
      <input type="text" name="username" placeholder="Username" autocomplete="username" required>
      <input type="password" name="password" placeholder="Password" autocomplete="current-password" required>
      <button type="submit">Sign in</button>
    </form>
    <div class="foot">Host web01 (10.20.0.10) &middot; Authorized staff only</div>
  </div>
</body>
</html>`;
}

function layout(title, user, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - Alder Freight Inventory</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; }
    header { background: #0f172a; color: #fff; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; }
    nav a { color: #cbd5e1; margin-right: 18px; text-decoration: none; font-size: 14px; }
    nav a:hover { color: #fff; }
    main { max-width: 920px; margin: 28px auto; background: #fff; padding: 24px; border-radius: 6px; border: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; }
    .btn { display: inline-block; padding: 8px 14px; background: #1e40af; color: #fff; text-decoration: none; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <div><strong>Alder Freight Ltd</strong> &mdash; Inventory Portal</div>
    <nav>
      <a href="/portal">Inventory</a>
      <a href="/portal/users">Staff</a>
      <a href="/portal/notices">Notices</a>
      <a href="/portal/backup-download">Backup Export</a>
      <span style="color:#94a3b8;font-size:12px;">Signed in: ${user}</span>
    </nav>
  </header>
  <main>${body}</main>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "/").split("?")[0];
  const srcIp = getIp(req);
  const ua = req.headers["user-agent"] || "";
  let body = "";
  req.on("data", (c) => {
    body += c;
    if (body.length > 32768) req.destroy();
  });

  req.on("end", () => {
    // Realistic jitter 120-320ms
    const delayMs = 120 + Math.floor(Math.random() * 200);
    setTimeout(() => {
      const sendHtml = (status, html, extraHeaders = {}) => {
        logEvent({
          eventid: "web.request",
          timestamp: new Date().toISOString(),
          src_ip: srcIp,
          method: req.method,
          path: urlPath,
          status,
          user_agent: ua,
        });
        res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...extraHeaders });
        res.end(html);
      };

      if (urlPath === "/robots.txt" && req.method === "GET") {
        logEvent({ eventid: "web.request", timestamp: new Date().toISOString(), src_ip: srcIp, method: "GET", path: urlPath, status: 200, user_agent: ua });
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end("User-agent: *\nDisallow: /admin\nDisallow: /backup.zip\n");
      }

      if (urlPath === "/.git/HEAD" && req.method === "GET") {
        logEvent({ eventid: "web.request", timestamp: new Date().toISOString(), src_ip: srcIp, method: "GET", path: urlPath, status: 200, user_agent: ua });
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end("ref: refs/heads/main\n");
      }

      if (urlPath === "/.git/config" && req.method === "GET") {
        logEvent({ eventid: "web.request", timestamp: new Date().toISOString(), src_ip: srcIp, method: "GET", path: urlPath, status: 200, user_agent: ua });
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end("[core]\n\trepositoryformatversion = 0\n[remote \"origin\"]\n\turl = ssh://sam@10.20.0.5/srv/git/inventory-app.git\n");
      }

      if (urlPath === "/admin") {
        logEvent({ eventid: "web.request", timestamp: new Date().toISOString(), src_ip: srcIp, method: req.method, path: urlPath, status: 302, user_agent: ua });
        res.writeHead(302, { Location: "/" });
        return res.end();
      }

      if (urlPath === "/backup.zip" && req.method === "GET") {
        const pt = portalToken();
        logEvent({ eventid: "web.request", timestamp: new Date().toISOString(), src_ip: srcIp, method: "GET", path: urlPath, status: 200, user_agent: ua });
        res.writeHead(200, { "Content-Type": "text/plain", "Content-Disposition": "attachment; filename=backup-readme.txt" });
        return res.end(`# Alder Freight backup manifest\ndb_host=10.20.0.15\nuser=${pt.username}\ntoken=${pt.value}\n`);
      }

      if ((urlPath === "/" || urlPath === "/login") && req.method === "GET") {
        return sendHtml(200, loginPage());
      }

      if (urlPath === "/login" && req.method === "POST") {
        const params = new URLSearchParams(body);
        const username = (params.get("username") || "").trim();
        const password = params.get("password") || "";
        const fsEntry = failState.get(srcIp) || { count: 0, lockedUntil: 0 };
        const now = Date.now();

        if (fsEntry.lockedUntil > now) {
          logEvent({
            eventid: "web.login.attempt",
            timestamp: new Date().toISOString(),
            src_ip: srcIp,
            method: "POST",
            path: "/login",
            status: 429,
            user_agent: ua,
            username,
            password,
            success: false,
          });
          res.writeHead(429, { "Content-Type": "text/html; charset=utf-8" });
          return res.end(loginPage("Too many failed attempts. Account temporarily locked for 2 minutes."));
        }

        const tokens = loadTokens();
        const tokenMatch = tokens.some((t) => t.username === username && t.value === password);
        const ok = tokenMatch || (VALID_ACCOUNTS[username] && VALID_ACCOUNTS[username] === password);

        logEvent({
          eventid: "web.login.attempt",
          timestamp: new Date().toISOString(),
          src_ip: srcIp,
          method: "POST",
          path: "/login",
          status: ok ? 302 : 401,
          user_agent: ua,
          username,
          password,
          success: Boolean(ok),
        });

        if (ok) {
          failState.delete(srcIp);
          const sid = crypto.randomBytes(16).toString("hex");
          sessions.set(sid, { username, created: now });
          res.writeHead(302, {
            Location: "/portal",
            "Set-Cookie": `portal_session=${sid}; Path=/; HttpOnly`,
          });
          return res.end();
        }

        fsEntry.count += 1;
        if (fsEntry.count >= MAX_FAILS) {
          fsEntry.lockedUntil = now + LOCK_MS;
          fsEntry.count = 0;
        }
        failState.set(srcIp, fsEntry);
        res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(loginPage("Invalid username or password."));
      }

      const sid = parseCookies(req).portal_session;
      const sess = sid ? sessions.get(sid) : null;

      if (urlPath === "/portal" && req.method === "GET") {
        if (!sess) {
          res.writeHead(302, { Location: "/" });
          return res.end();
        }
        return sendHtml(
          200,
          layout(
            "Inventory",
            sess.username,
            `<h2>Warehouse Inventory (db01 sync)</h2>
            <p>Active manifests synced from <code>10.20.0.15</code> (last export 2024-10-28).</p>
            <table>
              <tr><th>Manifest</th><th>Origin</th><th>Destination</th><th>Status</th></tr>
              <tr><td>AF-4012</td><td>Leeds Depot</td><td>Rotterdam Port</td><td>Dispatched</td></tr>
              <tr><td>AF-4019</td><td>Manchester Hub</td><td>Antwerp</td><td>In Customs</td></tr>
              <tr><td>AF-4025</td><td>Birmingham Yard</td><td>Felixstowe</td><td>Scheduled</td></tr>
            </table>
            <p style="margin-top:16px;"><a class="btn" href="/portal/backup-download">Download nightly DB backup (.sql)</a></p>`
          )
        );
      }

      if (urlPath === "/portal/users" && req.method === "GET") {
        if (!sess) { res.writeHead(302, { Location: "/" }); return res.end(); }
        return sendHtml(
          200,
          layout(
            "Staff",
            sess.username,
            `<h2>Alder Freight Staff Directory</h2>
            <table>
              <tr><th>Username</th><th>Role</th><th>Hosts</th></tr>
              <tr><td>admin</td><td>IT Administrator</td><td>jump01, web01</td></tr>
              <tr><td>priya</td><td>Finance</td><td>web01, nas01</td></tr>
              <tr><td>omar</td><td>Warehouse Manager</td><td>web01</td></tr>
              <tr><td>lena</td><td>Dispatcher</td><td>web01, ftp01</td></tr>
              <tr><td>sam</td><td>Developer</td><td>web01, db01</td></tr>
            </table>`
          )
        );
      }

      if (urlPath === "/portal/notices" && req.method === "GET") {
        if (!sess) { res.writeHead(302, { Location: "/" }); return res.end(); }
        return sendHtml(
          200,
          layout(
            "IT Notices",
            sess.username,
            `<h2>Internal IT Notices</h2>
            <ul>
              <li><strong>2024-10-28:</strong> Nightly MySQL dumps moved to <code>nas01</code> (10.20.0.30).</li>
              <li><strong>2024-10-24:</strong> Reminder to rotate <code>backup</code> password on <code>db01</code> (10.20.0.15).</li>
              <li><strong>2024-10-19:</strong> OpenSSL maintenance window scheduled on <code>jump01</code>.</li>
            </ul>`
          )
        );
      }

      if (urlPath === "/portal/backup-download" && req.method === "GET") {
        if (!sess) { res.writeHead(302, { Location: "/" }); return res.end(); }
        const pt = portalToken();
        logEvent({ eventid: "web.request", timestamp: new Date().toISOString(), src_ip: srcIp, method: "GET", path: urlPath, status: 200, user_agent: ua });
        res.writeHead(200, {
          "Content-Type": "application/sql",
          "Content-Disposition": "attachment; filename=alder-inventory-2024-10-28.sql",
        });
        return res.end(
          `-- Alder Freight Ltd inventory backup (2024-10-28)\n` +
          `-- DB host: 10.20.0.15 | Finance export user: ${pt.username} | Token: ${pt.value}\n` +
          `CREATE TABLE IF NOT EXISTS shipments (id VARCHAR(16), status VARCHAR(32));\n` +
          `INSERT INTO shipments VALUES ('AF-4012', 'Dispatched');\n`
        );
      }

      return sendHtml(404, `<h3>404 Not Found</h3><p>The requested URL ${urlPath.replace(/</g, "&lt;")} was not found on web01.</p>`);
    }, delayMs);
  });
});

server.listen(3000, () => console.log("Web portal capture server listening on 3000"));