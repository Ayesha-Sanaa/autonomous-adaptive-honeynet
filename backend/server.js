const http = require("http");
const fs = require("fs");

const LOG_FILE = "/logs/web.json";

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    const params = new URLSearchParams(body);
    const event = {
      eventid: "web.login.attempt",
      timestamp: new Date().toISOString(),
      src_ip: req.headers["x-real-ip"] || req.socket.remoteAddress,
      method: req.method,
      path: req.url,
      user_agent: req.headers["user-agent"],
      username: params.get("username"),
      password: params.get("password"),
    };
    fs.appendFileSync(LOG_FILE, JSON.stringify(event) + "\n");
    res.writeHead(401, { "Content-Type": "text/html" });
    res.end("<h3>Invalid username or password</h3><a href='/'>Back</a>");
  });
});

server.listen(3000, () => console.log("Backend listening on 3000"));