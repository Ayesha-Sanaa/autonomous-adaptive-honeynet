module.exports = function normalizeWebPortal(e) {
  if (e.eventid !== "web.login.attempt" && e.eventid !== "web.request") return null;
  const isLogin = e.eventid === "web.login.attempt" || (e.method === "POST" && e.path === "/login");
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
    method: e.method ?? null,
    path: e.path ?? null,
    status: typeof e.status === "number" ? e.status : null,
    user_agent: e.user_agent ?? null,
    username: e.username ?? null,
    password: e.password ?? null,
    command: isLogin ? null : `${e.method || "GET"} ${e.path || "/"}`,
    success: isLogin ? Boolean(e.success) : null,
    raw: e,
  };
};