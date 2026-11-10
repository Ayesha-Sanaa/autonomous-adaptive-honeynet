const http = require("http");
const { MongoClient } = require("mongodb");
const { attackersPipeline, sessionsPipeline, shapeAttacker, shapeSession } = require("./analytics");
const auth = require("./auth");

const MONGO_URL = process.env.MONGO_URL || "mongodb://mongodb:27017";
const PORT = Number(process.env.PORT || 3001);
const FILTERS = ["decoy", "src_ip", "protocol", "event_type", "session"];

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function top(events, field, n = 5) {
  return events
    .aggregate([
      { $match: { [field]: { $ne: null } } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: n },
      { $project: { _id: 0, value: "$_id", count: 1 } },
    ])
    .toArray();
}

// Reads a small JSON body (max 10 KB).
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooBig = false;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 10_000) {
        if (!tooBig) reject(new auth.HttpError(413, "body too large"));
        tooBig = true; // keep nothing, just stop collecting
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

      // ---- open routes ----
      if (path === "/health" && method === "GET") return send(res, 200, { ok: true });

      if (path === "/auth/login" && method === "POST") {
        const { username, password } = await readJson(req);
        const session = await auth.login(db, username, password);
        if (!session) return send(res, 401, { error: "invalid username or password" });
        return send(res, 200, session);
      }

      // ---- everything below needs a signed-in user ----
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

      // ---- admin only: manage accounts ----
      if (path === "/users" || path.startsWith("/users/")) {
        if (user.role !== "admin") return send(res, 403, { error: "admins only" });
        if (path === "/users" && method === "GET") return send(res, 200, await auth.listUsers(db));
        if (path === "/users" && method === "POST") {
          const { username, password, role } = await readJson(req);
          return send(res, 201, await auth.createUser(db, { username, password, role }));
        }
        if (path.startsWith("/users/") && method === "DELETE") {
          await auth.deleteUser(db, user.username, decodeURIComponent(path.slice(7)));
          return send(res, 200, { ok: true });
        }
        return send(res, 405, { error: "method not allowed" });
      }

      // ---- data routes (read only) ----
      if (method !== "GET") return send(res, 405, { error: "method not allowed" });

      if (path === "/events") {
        const filter = {};
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
        return send(res, 200, {
          total: await events.countDocuments(),
          by_decoy: await top(events, "decoy", 10),
          by_event_type: await top(events, "event_type", 10),
          top_src_ip: await top(events, "src_ip"),
          top_usernames: await top(events, "username"),
          top_passwords: await top(events, "password"),
          top_commands: await top(events, "command"),
        });
      }

      if (path === "/attackers") {
        const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
        const docs = await events.aggregate(attackersPipeline(limit)).toArray();
        return send(res, 200, docs.map(shapeAttacker));
      }

      if (path === "/sessions") {
        const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
        const docs = await events.aggregate(sessionsPipeline(limit)).toArray();
        return send(res, 200, docs.map(shapeSession));
      }

      send(res, 404, { error: "not found" });
    } catch (err) {
      if (err instanceof auth.HttpError) {
        if (err.status === 413) res.once("finish", () => req.destroy()); // answer first, then drop the connection
        return send(res, err.status, { error: err.message });
      }
      console.error(err.message);
      send(res, 500, { error: "internal error" });
    }
  });
}

async function main() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db("honeynet");
  await auth.ensureIndexes(db);
  buildServer(db).listen(PORT, () => console.log(`api listening on ${PORT}`));
}

if (require.main === module) main();

module.exports = { buildServer };