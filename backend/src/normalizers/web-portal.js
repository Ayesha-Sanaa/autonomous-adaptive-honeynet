module.exports = function normalizeWebPortal(e) {
  if (e.eventid !== "web.login.attempt") return null;
  const isLogin = e.method === "POST" && e.path === "/login";
  return {
    timestamp: e.timestamp,
    decoy: "web-portal",
    sensor: null,
    session: null,
    protocol: "http",
    event_type: isLogin ? "login_attempt" : "request",
    src_ip: e.src_ip,
    src_port: null,
    dst_port: null,
    username: e.username ?? null,
    password: e.password ?? null,
    command: null,
    success: isLogin ? false : null,
    raw: e,
  };
};