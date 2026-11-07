const PROTOCOLS = { smbd: "smb" };

module.exports = function normalizeDionaea(e) {
  const c = e.connection;
  const isAccept = c && c.type === "accept";
  const protocol = c ? c.protocol : null;
  return {
    timestamp: e.timestamp.endsWith("Z") ? e.timestamp : e.timestamp + "Z",
    decoy: "dionaea",
    sensor: null,
    session: null,
    protocol: PROTOCOLS[protocol] ?? protocol,
    event_type: isAccept ? "connect" : "other",
    src_ip: e.src_ip,
    src_port: e.src_port,
    dst_port: e.dst_port,
    username: null,
    password: null,
    command: null,
    success: null,
    raw: e,
  };
};