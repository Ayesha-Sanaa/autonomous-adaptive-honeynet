// Users, passwords and login sessions.
// Passwords are never stored: only a salted scrypt hash. Session tokens are never stored either:
// only their SHA-256 hash, so a leaked database cannot be used to sign in.
const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);

const SCRYPT = { N: 65536, r: 8, p: 2, keylen: 64 }; // OWASP-recommended scrypt setting (N=2^16, r=8, p=2)
const MAXMEM = 128 * 1024 * 1024;
const SESSION_HOURS = 8;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 128;
const ROLES = ["admin", "analyst"];
const MAX_PENDING = 50; // account requests waiting for an admin
const REQUEST_DAYS = 14; // an unanswered request is deleted after this many days
const SIGNUPS_PER_HOUR = 10; // across everyone: the website calls the API from one address, so this is one shared limit
const recentSignups = [];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const norm = (s) => String(s ?? "").normalize("NFKC");
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const { N, r, p, keylen } = SCRYPT;
  const hash = await scrypt(norm(password), salt, keylen, { N, r, p, maxmem: MAXMEM });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored).split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(norm(password), Buffer.from(salt, "base64"), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: MAXMEM,
  });
  return crypto.timingSafeEqual(actual, expected);
}

// A fake hash, checked when the username does not exist, so "no such user" takes as long as "wrong password".
let dummyHash;
const getDummy = async () => (dummyHash ||= await hashPassword(crypto.randomBytes(16).toString("hex")));

function checkUsername(username) {
  const u = String(username ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(u)) throw new HttpError(400, "username must be 3-32 characters: letters, digits, . _ -");
  return u;
}

function checkPassword(password, username) {
  const pw = norm(password);
  if (pw.length < MIN_PASSWORD) throw new HttpError(400, `password must be at least ${MIN_PASSWORD} characters`);
  if (pw.length > MAX_PASSWORD) throw new HttpError(400, `password must be at most ${MAX_PASSWORD} characters`);
  if (username && pw.toLowerCase().includes(username)) throw new HttpError(400, "password must not contain the username");
  if (/^(.)\1+$/.test(pw)) throw new HttpError(400, "password is too simple");
  return pw;
}

async function ensureIndexes(db) {
  await db.collection("sessions").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }); // Mongo deletes expired sessions itself
  await db.collection("sessions").createIndex({ username: 1 });
  await db.collection("signup_requests").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
  await db.collection("audit").createIndex({ time: -1 });
}

// A short record of what admins did, so nothing about accounts changes silently.
async function audit(db, actor, action, target, detail = null) {
  await db.collection("audit").insertOne({ time: new Date(), actor, action, target, detail });
}

async function createUser(db, { username, password, role }) {
  const u = checkUsername(username);
  const pw = checkPassword(password, u);
  if (!ROLES.includes(role)) throw new HttpError(400, `role must be one of: ${ROLES.join(", ")}`);
  const doc = { _id: u, password: await hashPassword(pw), role, created_at: new Date(), failed_logins: 0, locked_until: null };
  try {
    await db.collection("users").insertOne(doc);
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, "that username already exists");
    throw err;
  }
  return { username: u, role };
}

// Returns { token, expires_at, user } or null. The caller must answer "invalid username or password" for null.
async function login(db, username, password) {
  const users = db.collection("users");
  const u = String(username ?? "").trim().toLowerCase();
  const user = u ? await users.findOne({ _id: u }) : null;
  const locked = user && user.locked_until && user.locked_until > new Date();
  const passwordOk = await verifyPassword(String(password ?? ""), user ? user.password : await getDummy());

  if (!user || locked || !passwordOk) {
    if (user && !locked) {
      const fails = (user.failed_logins || 0) + 1;
      if (fails >= MAX_FAILS) {
        await users.updateOne({ _id: u }, { $set: { failed_logins: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60000) } });
      } else {
        await users.updateOne({ _id: u }, { $set: { failed_logins: fails } });
      }
    }
    return null;
  }

  await users.updateOne({ _id: u }, { $set: { failed_logins: 0, locked_until: null, last_login: new Date() } });
  const token = crypto.randomBytes(32).toString("base64url");
  const expires_at = new Date(Date.now() + SESSION_HOURS * 3600000);
  await db.collection("sessions").insertOne({ _id: sha256(token), username: u, created_at: new Date(), expires_at });
  return { token, expires_at, user: { username: u, role: user.role } };
}

// Token -> { username, role }, or null if unknown, expired, or the user was removed.
async function sessionUser(db, token) {
  const s = await db.collection("sessions").findOne({ _id: sha256(token) });
  if (!s || s.expires_at <= new Date()) return null;
  const user = await db.collection("users").findOne({ _id: s.username });
  return user ? { username: user._id, role: user.role } : null;
}

async function logout(db, token) {
  await db.collection("sessions").deleteOne({ _id: sha256(token) });
}

// Changing the password signs the user out everywhere except the session they are using.
async function changePassword(db, username, token, current, next) {
  const user = await db.collection("users").findOne({ _id: username });
  if (!user || !(await verifyPassword(String(current ?? ""), user.password))) throw new HttpError(403, "current password is wrong");
  const pw = checkPassword(next, username);
  await db.collection("users").updateOne({ _id: username }, { $set: { password: await hashPassword(pw) } });
  await db.collection("sessions").deleteMany({ username, _id: { $ne: sha256(token) } });
}

async function listUsers(db) {
  const docs = await db.collection("users").find({}, { projection: { password: 0 } }).toArray();
  return docs.map((d) => ({ username: d._id, role: d.role, created_at: d.created_at, last_login: d.last_login || null }));
}

async function deleteUser(db, actor, username) {
  const u = checkUsername(username);
  if (u === actor) throw new HttpError(400, "you cannot delete your own account");
  const target = await db.collection("users").findOne({ _id: u });
  if (!target) throw new HttpError(404, "no such user");
  if (target.role === "admin" && (await db.collection("users").countDocuments({ role: "admin" })) <= 1) {
    throw new HttpError(400, "cannot delete the last admin");
  }
  await db.collection("users").deleteOne({ _id: u });
  await db.collection("sessions").deleteMany({ username: u });
  await audit(db, actor, "removed user", u, target.role);
}

// Anyone can ask for an account. It cannot sign in until an admin approves it.
// A taken username gets the same answer as a free one, so this cannot be used to find out who has an account.
async function requestSignup(db, { username, password, reason }) {
  const now = Date.now();
  while (recentSignups.length && recentSignups[0] < now - 3600000) recentSignups.shift();
  if (recentSignups.length >= SIGNUPS_PER_HOUR) throw new HttpError(429, "too many requests right now, try again later");
  recentSignups.push(now);

  const u = checkUsername(username);
  const pw = checkPassword(password, u);
  const note = String(reason ?? "").trim().slice(0, 200);
  const requests = db.collection("signup_requests");
  if ((await requests.countDocuments()) >= MAX_PENDING) throw new HttpError(429, "too many requests are waiting, ask an admin to clear them");

  const hash = await hashPassword(pw); // always hashed, so the answer takes the same time either way
  if (await db.collection("users").findOne({ _id: u }, { projection: { _id: 1 } })) return;
  try {
    await requests.insertOne({ _id: u, password: hash, reason: note, created_at: new Date(), expires_at: new Date(now + REQUEST_DAYS * 86400000) });
  } catch (err) {
    if (err.code !== 11000) throw err; // already waiting: nothing to do
  }
}

async function listRequests(db) {
  const docs = await db.collection("signup_requests").find({}, { projection: { password: 0 } }).sort({ created_at: 1 }).toArray();
  return docs.map((d) => ({ username: d._id, reason: d.reason || "", created_at: d.created_at }));
}

async function approveRequest(db, actor, username, role) {
  const u = checkUsername(username);
  if (!ROLES.includes(role)) throw new HttpError(400, `role must be one of: ${ROLES.join(", ")}`);
  const requests = db.collection("signup_requests");
  const request = await requests.findOne({ _id: u });
  if (!request) throw new HttpError(404, "no such request");
  try {
    await db.collection("users").insertOne({ _id: u, password: request.password, role, created_at: new Date(), failed_logins: 0, locked_until: null, approved_by: actor });
  } catch (err) {
    if (err.code === 11000) {
      await requests.deleteOne({ _id: u });
      throw new HttpError(409, "that username already exists");
    }
    throw err;
  }
  await requests.deleteOne({ _id: u });
  await audit(db, actor, "approved account", u, role);
  return { username: u, role };
}

async function rejectRequest(db, actor, username) {
  const u = checkUsername(username);
  const { deletedCount } = await db.collection("signup_requests").deleteOne({ _id: u });
  if (!deletedCount) throw new HttpError(404, "no such request");
  await audit(db, actor, "rejected request", u);
}

// The role is read from the database on every request, so a change takes effect immediately.
async function setRole(db, actor, username, role) {
  const u = checkUsername(username);
  if (!ROLES.includes(role)) throw new HttpError(400, `role must be one of: ${ROLES.join(", ")}`);
  if (u === actor) throw new HttpError(400, "you cannot change your own role");
  const target = await db.collection("users").findOne({ _id: u });
  if (!target) throw new HttpError(404, "no such user");
  if (target.role === role) return { username: u, role };
  await db.collection("users").updateOne({ _id: u }, { $set: { role } });
  await audit(db, actor, "changed role", u, `${target.role} to ${role}`);
  return { username: u, role };
}

async function listAudit(db, limit = 20) {
  const docs = await db.collection("audit").find({}).sort({ time: -1 }).limit(limit).toArray();
  return docs.map((d) => ({ time: d.time, actor: d.actor, action: d.action, target: d.target, detail: d.detail || null }));
}

module.exports = {
  HttpError, ROLES, ensureIndexes, hashPassword, verifyPassword, createUser, login, sessionUser, logout, changePassword,
  listUsers, deleteUser, requestSignup, listRequests, approveRequest, rejectRequest, setRole, listAudit,
};