/**
 * Features extraction module for Adaptive RL Engine.
 * Extracts the 25 normalized features from MongoDB events for a given session or attacker IP.
 * Uses rl/features.json as the single source of truth for ranges and ordering.
 */

const path = require("path");
const fs = require("fs");

let spec = null;
function getSpec() {
  if (spec) return spec;
  const candidates = [
    path.resolve(__dirname, "../../rl/features.json"),
    path.resolve(__dirname, "../features.json"),
    path.resolve(__dirname, "../../features.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      spec = JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
      return spec;
    }
  }
  return {
    total_features: 25,
    features: Array.from({ length: 25 }, (_, i) => ({ index: i, range: [0, 100] })),
  };
}

const RECON_REGEX = /\b(whoami|id|w|who|users|last|uname|hostname|lscpu|free|df|dmesg|ps|top|pgrep|ifconfig|route|ip|netstat|ss)\b/i;
const DOWNLOAD_REGEX = /\b(wget|curl|tftp|ftpget|scp)\b/i;
const EVASION_REGEX = /history\s+-c|unset\s+HISTFILE|HISTSIZE=0/i;

async function extractSessionFeatures(db, { session, src_ip }) {
  const eventsCol = db.collection("events");
  const query = {};
  if (session) query.session = String(session);
  else if (src_ip) query.src_ip = String(src_ip);
  else throw new Error("Either session or src_ip must be provided");

  const events = await eventsCol.find(query).sort({ timestamp: 1 }).toArray();

  if (!events || events.length === 0) {
    const zeros = new Array(25).fill(0.0);
    return { raw: zeros, normalized: zeros, eventsCount: 0 };
  }

  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];

  const firstTime = new Date(firstEvent.timestamp).getTime();
  const lastTime = new Date(lastEvent.timestamp).getTime();
  const now = Date.now();

  const durationSec = Math.max(1, Math.round((lastTime - firstTime) / 1000));
  const totalEvents = events.length;
  const eventRatePerMin = totalEvents / Math.max(0.1, durationSec / 60);
  const timeSinceLastEvent = Math.max(0, Math.round((now - lastTime) / 1000));

  const hasSessionEnd = events.some((e) => e.event_type === "session_end");
  const isActiveSession = hasSessionEnd ? 0 : 1;

  const loginAttempts = events.filter((e) => e.event_type === "login_attempt");
  const loginAttemptsCount = loginAttempts.length;

  const usernames = new Set(loginAttempts.map((e) => e.username).filter(Boolean));
  const passwords = new Set(loginAttempts.map((e) => e.password).filter(Boolean));
  const hasSuccessfulLogin = loginAttempts.some((e) => e.success === true) ? 1 : 0;
  const credentialRepetitionRatio = loginAttemptsCount > 0 ? passwords.size / loginAttemptsCount : 0.0;

  const commandEvents = events.filter((e) => e.event_type === "command" && e.command);
  const commandsCount = commandEvents.length;
  const distinctCommands = new Set(commandEvents.map((e) => e.command.trim()));

  let reconCommands = 0;
  let downloadAttempts = 0;
  let evasionCommands = 0;

  for (const cmd of distinctCommands) {
    if (RECON_REGEX.test(cmd)) reconCommands++;
    if (DOWNLOAD_REGEX.test(cmd)) downloadAttempts++;
    if (EVASION_REGEX.test(cmd)) evasionCommands++;
  }

  const decoysTouched = new Set(events.map((e) => e.decoy).filter(Boolean));
  const protocolsTouched = new Set(events.map((e) => e.protocol).filter(Boolean));

  const touchesCowrie = decoysTouched.has("cowrie") ? 1 : 0;
  const touchesWebPortal = decoysTouched.has("web-portal") ? 1 : 0;
  const touchesDionaeaOrHeralding = (decoysTouched.has("dionaea") || decoysTouched.has("heralding")) ? 1 : 0;

  const uniqueTechniques = new Set();
  const uniqueTactics = new Set();
  let highConfidenceAttacks = 0;

  for (const e of events) {
    if (Array.isArray(e.attack)) {
      for (const a of e.attack) {
        if (a.id) uniqueTechniques.add(a.id);
        if (Array.isArray(a.tactics)) a.tactics.forEach((t) => uniqueTactics.add(t));
        if (a.confidence === "high") highConfidenceAttacks++;
      }
    }
  }

  const isScanner = decoysTouched.size >= 3 ? 1 : 0;

  let threatDepth = 0.0;
  if (totalEvents > 0) threatDepth = 1.0;
  if (loginAttemptsCount > 0) threatDepth = 2.0;
  if (hasSuccessfulLogin) threatDepth = 5.0;
  if (reconCommands > 0) threatDepth = 7.0;
  if (downloadAttempts > 0) threatDepth = 9.0;
  if (evasionCommands > 0) threatDepth = 10.0;

  const raw = [
    durationSec, totalEvents, eventRatePerMin, timeSinceLastEvent, isActiveSession,
    loginAttemptsCount, usernames.size, passwords.size, hasSuccessfulLogin, credentialRepetitionRatio,
    commandsCount, distinctCommands.size, reconCommands, downloadAttempts, evasionCommands,
    decoysTouched.size, protocolsTouched.size, touchesCowrie, touchesWebPortal, touchesDionaeaOrHeralding,
    uniqueTechniques.size, uniqueTactics.size, highConfidenceAttacks, isScanner, threatDepth,
  ];

  const featureSpec = getSpec();
  const normalized = raw.map((val, idx) => {
    const f = featureSpec.features[idx] || { range: [0, 100] };
    const [minV, maxV] = f.range;
    const span = maxV > minV ? maxV - minV : 1.0;
    const clamped = Math.min(Math.max(val, minV), maxV);
    return Number(((clamped - minV) / span).toFixed(4));
  });

  return {
    raw,
    normalized,
    eventsCount: totalEvents,
    src_ip: events[0].src_ip,
    session: session || events[0].session,
  };
}

module.exports = { extractSessionFeatures, getSpec };
