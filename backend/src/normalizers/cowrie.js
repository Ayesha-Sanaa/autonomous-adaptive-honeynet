const TYPES = {
  "cowrie.session.connect": "connect",
  "cowrie.login.success": "login_attempt",
  "cowrie.login.failed": "login_attempt",
  "cowrie.command.input": "command",
  "cowrie.session.closed": "session_end",
  "cowrie.client.version": "client_version",
  "cowrie.client.kex": "client_kex",
};

module.exports = function normalizeCowrie(e) {
  const event_type = TYPES[e.eventid];
  if (!event_type) return null;
  return {
    timestamp: e.timestamp,
    decoy: "cowrie",
    sensor: e.sensor,
    session: e.session,
    protocol: e.protocol || "ssh",
    event_type,
    src_ip: e.src_ip,
    src_port: e.src_port,
    dst_port: e.dst_port,
    username: e.username ?? null,
    password: e.password ?? null,
    command: e.input ?? null,
    client_version: e.version ?? null,
    kex_hassh: e.hassh ?? null,
    success:
      e.eventid === "cowrie.login.success" ? true
      : e.eventid === "cowrie.login.failed" ? false
      : null,
    raw: e,
  };
};