// Parses MariaDB general query log lines for S5 MySQL honeytoken capture:
// Example: 2024-11-24T12:00:00.123456Z   12 Connect  backup@10.244.0.5 on inventory using TCP/IP
//          2024-11-24T12:00:00.123456Z   12 Connect  Access denied for user 'backup'@'10.244.0.5' (using password: YES)
module.exports = function normalizeMariadb(line) {
  if (!line || typeof line !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2}T\S+)\s+\d+\s+(Connect|Query)\s+(.*)$/.exec(line.trim());
  if (!m) return null;
  const [, ts, cmdType, rest] = m;

  if (cmdType === "Connect") {
    const denied = /Access denied for user '([^']*)'@'([^']*)'/.exec(rest);
    if (denied) {
      return {
        timestamp: ts,
        decoy: "mariadb",
        sensor: null,
        session: null,
        protocol: "mysql",
        event_type: "login_attempt",
        src_ip: denied[2],
        src_port: null,
        dst_port: 3306,
        username: denied[1],
        password: null,
        command: null,
        success: false,
        raw: line,
      };
    }
    const ok = /^([^@\s]+)@([^\s]+)\s+on\s+(\S*)/.exec(rest);
    if (ok) {
      return {
        timestamp: ts,
        decoy: "mariadb",
        sensor: null,
        session: null,
        protocol: "mysql",
        event_type: "login_attempt",
        src_ip: ok[2],
        src_port: null,
        dst_port: 3306,
        username: ok[1],
        password: null,
        command: null,
        success: true,
        raw: line,
      };
    }
  }

  if (cmdType === "Query") {
    return {
      timestamp: ts,
      decoy: "mariadb",
      sensor: null,
      session: null,
      protocol: "mysql",
      event_type: "command",
      src_ip: null,
      src_port: null,
      dst_port: 3306,
      username: null,
      password: null,
      command: rest.slice(0, 500),
      success: null,
      raw: line,
    };
  }
  return null;
};
