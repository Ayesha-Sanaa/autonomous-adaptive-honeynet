module.exports = function normalizeHeralding(r) {
  return {
    timestamp: r.timestamp.replace(" ", "T") + "Z",
    decoy: "heralding",
    sensor: null,
    session: r.session_id,
    protocol: r.protocol,
    event_type: "login_attempt",
    src_ip: r.source_ip,
    src_port: Number(r.source_port),
    dst_port: Number(r.destination_port),
    username: r.username || null,
    password: r.password || null,
    command: null,
    success: false,
    raw: r,
  };
};