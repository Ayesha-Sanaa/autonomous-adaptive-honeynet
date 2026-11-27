const { scanTechnique } = require("./mitre");

// One row per attacker IP (or filtered by specific IP and/or demo mode)
const attackersPipeline = (limit, matchQuery = { src_ip: { $ne: null } }) => [
  { $match: matchQuery },
  { $sort: { timestamp: 1 } },
  {
    $group: {
      _id: "$src_ip",
      events: { $sum: 1 },
      first_seen: { $min: "$timestamp" },
      last_seen: { $max: "$timestamp" },
      decoys: { $addToSet: "$decoy" },
      visits: { $push: { d: "$decoy", t: "$timestamp" } },
      techniques: { $push: "$attack" },
    },
  },
  { $sort: { events: -1 } },
  ...(limit ? [{ $limit: limit }] : []),
];

const sessionsPipeline = (limit, matchQuery = { session: { $ne: null } }) => [
  { $match: matchQuery },
  { $sort: { timestamp: 1 } },
  {
    $group: {
      _id: "$session",
      decoy: { $first: "$decoy" },
      src_ip: { $first: "$src_ip" },
      start: { $min: "$timestamp" },
      end: { $max: "$timestamp" },
      events: { $sum: 1 },
      steps: {
        $push: { type: "$event_type", command: "$command", username: "$username", success: "$success", attack: "$attack" },
      },
    },
  },
  { $sort: { start: -1 } },
  ...(limit ? [{ $limit: limit }] : []),
];

function countTechniques(lists) {
  const counts = new Map();
  for (const list of lists) {
    for (const a of list || []) {
      const c = counts.get(a.id) || { id: a.id, name: a.name, tactics: a.tactics, events: 0 };
      c.events++;
      counts.set(a.id, c);
    }
  }
  return [...counts.values()].sort((x, y) => y.events - x.events);
}

function shapeAttacker(doc) {
  const scan = scanTechnique(doc.visits);
  return {
    src_ip: doc._id,
    events: doc.events,
    first_seen: doc.first_seen,
    last_seen: doc.last_seen,
    decoys: doc.decoys.sort(),
    techniques: countTechniques(doc.techniques),
    behaviours: scan ? [scan] : [],
  };
}

function shapeSession(doc) {
  const logins = doc.steps
    .filter((s) => s.type === "login_attempt")
    .map((s) => ({ username: s.username, success: s.success }));
  return {
    session: doc._id,
    decoy: doc.decoy,
    src_ip: doc.src_ip,
    start: doc.start,
    end: doc.end,
    duration_s: Math.round((doc.end - doc.start) / 1000),
    events: doc.events,
    logins,
    login_success: logins.some((l) => l.success === true),
    commands: doc.steps.filter((s) => s.command).map((s) => s.command),
    techniques: countTechniques(doc.steps.map((s) => s.attack)),
  };
}

module.exports = { attackersPipeline, sessionsPipeline, shapeAttacker, shapeSession };
