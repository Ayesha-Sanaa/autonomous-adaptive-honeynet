const http = require("http");
const { MongoClient } = require("mongodb");
const { attackersPipeline, sessionsPipeline, shapeAttacker, shapeSession } = require("./analytics");

const MONGO_URL = process.env.MONGO_URL || "mongodb://mongodb:27017";
const PORT = Number(process.env.PORT || 3001);
const FILTERS = ["decoy", "src_ip", "protocol", "event_type", "session"];

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
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

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const events = client.db("honeynet").collection("events");

  http
    .createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost");
        if (req.method !== "GET") return send(res, 405, { error: "method not allowed" });

        if (url.pathname === "/health") return send(res, 200, { ok: true });

        if (url.pathname === "/events") {
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

        if (url.pathname === "/stats") {
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

        if (url.pathname === "/attackers") {
          const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
          const docs = await events.aggregate(attackersPipeline(limit)).toArray();
          return send(res, 200, docs.map(shapeAttacker));
        }

        if (url.pathname === "/sessions") {
          const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
          const docs = await events.aggregate(sessionsPipeline(limit)).toArray();
          return send(res, 200, docs.map(shapeSession));
        }

        send(res, 404, { error: "not found" });
      } catch (err) {
        console.error(err.message);
        send(res, 500, { error: "internal error" });
      }
    })
    .listen(PORT, () => console.log(`api listening on ${PORT}`));
})();