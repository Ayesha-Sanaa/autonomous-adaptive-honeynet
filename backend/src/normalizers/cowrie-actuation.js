module.exports = function normalizeCowrieActuation(e) {
  if (!e || e.eventid !== "cowrie.actuation.applied" || !e.session) return null;
  return {
    timestamp: e.timestamp || new Date().toISOString(),
    decoy: "cowrie",
    sensor: null,
    session: String(e.session),
    protocol: "ssh",
    event_type: "actuation_applied",
    src_ip: e.src_ip ?? null,
    src_port: null,
    dst_port: null,
    username: null,
    password: null,
    command: null,
    action: e.action,
    seq: e.seq ?? null,
    effect: e.effect || {},
    verified: Boolean(e.verified),
    success: null,
    raw: e,
  };
};
