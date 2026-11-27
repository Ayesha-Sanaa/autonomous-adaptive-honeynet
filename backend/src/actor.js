/**
 * S6 Bot-vs-Human classifier and skill-level safety mask.
 * Heuristic scoring across command cadence, login bursts, bot signatures,
 * SSH client fingerprints, and interactive exploration depth.
 */

const BOTNET_PASSWORDS = new Set([
  "123456", "password", "12345678", "qwerty", "admin", "root", "toor",
  "12345", "123456789", "letmein", "pass123", "alpine", "raspberry",
]);

const BOT_CLIENT_REGEX = /(paramiko|libssh|golang|go-ssh|masscan|zgrab|python|ssh2js|asyncssh)/i;
const BOT_SEQUENCE_REGEX = /(uname\s+-a.*?(wget|curl)|busybox|\/proc\/cpuinfo.*?wget|rm\s+-rf\s+\/tmp)/i;
const EXPLORE_CMD_REGEX = /^(ls|ll|cd|cat|head|tail|less|more|pwd|find|grep|nano|vi)\b/i;
const HIGH_SKILL_REGEX = /(config\.yml|backup\.sh|\.ssh\/|\.aws\/|authorized_keys|crontab|\/etc\/cron|mysql\s+-h|ssh\s+\S+@|wget\s+|curl\s+|scp\s+)/i;

function classifySession(events = []) {
  if (!events.length) {
    return {
      actor_type: "unknown",
      confidence: 0,
      reasons: ["No events recorded for session"],
      skill_level: "low",
      heuristic_note: "heuristic, calibrated for lab sessions",
    };
  }

  let botScore = 0;
  let humanScore = 0;
  const reasons = [];

  const logins = events.filter((e) => e.event_type === "login_attempt");
  const cmds = events.filter((e) => e.event_type === "command" && e.command);
  const clientVers = events.map((e) => e.client_version).filter(Boolean);

  // 1. Login burst: > 5 tries within 10s
  if (logins.length > 5) {
    const t0 = new Date(logins[0].timestamp).getTime();
    const t5 = new Date(logins[5].timestamp).getTime();
    if (t5 - t0 <= 10_000) {
      botScore += 3;
      reasons.push(`Rapid login burst (${logins.length} tries, >=6 in ${Math.round((t5 - t0) / 1000)}s)`);
    }
  }

  // Common botnet passwords
  const botPassHits = logins.filter((l) => l.password && BOTNET_PASSWORDS.has(String(l.password).toLowerCase()));
  if (botPassHits.length >= 2) {
    botScore += 1.5;
    reasons.push("Common botnet password list tried");
  }

  // 2. SSH client version fingerprint
  for (const cv of clientVers) {
    if (BOT_CLIENT_REGEX.test(cv)) {
      botScore += 2.5;
      reasons.push(`Automated SSH client banner (${cv})`);
      break;
    } else if (/openssh|putty|termius|kitty/i.test(cv)) {
      humanScore += 1;
      reasons.push(`Interactive SSH client (${cv})`);
      break;
    }
  }

  // 3. Command cadence & variance
  if (cmds.length >= 3) {
    const deltas = [];
    for (let i = 1; i < cmds.length; i++) {
      deltas.push(new Date(cmds[i].timestamp).getTime() - new Date(cmds[i - 1].timestamp).getTime());
    }
    const fastCount = deltas.filter((d) => d < 2000).length;
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const std = Math.sqrt(deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length);

    if (fastCount >= Math.max(2, Math.floor(deltas.length * 0.6))) {
      botScore += 2.5;
      reasons.push(`Fast automated command cadence (${fastCount}/${deltas.length} gaps < 2s)`);
    } else if (deltas.length >= 3 && std < 350 && mean < 4000) {
      botScore += 2;
      reasons.push(`Near-constant command interval (mean ${Math.round(mean)}ms, sd ${Math.round(std)}ms)`);
    } else if (mean >= 2200) {
      humanScore += 2.5;
      reasons.push(`Human-paced command intervals (mean ${(mean / 1000).toFixed(1)}s)`);
    }
  }

  // 4. Fixed bot sequence vs exploration
  const joinedCmds = cmds.map((c) => c.command.trim()).join(" ; ");
  if (BOT_SEQUENCE_REGEX.test(joinedCmds)) {
    botScore += 2.5;
    reasons.push("Fixed botnet recon-then-download command pattern");
  }

  const exploreCount = cmds.filter((c) => EXPLORE_CMD_REGEX.test(c.command.trim())).length;
  if (exploreCount >= 2) {
    humanScore += 2;
    reasons.push(`Interactive file/directory exploration (${exploreCount} inspect commands)`);
  }

  // Classification
  let actor_type = "unknown";
  let confidence = 0.5;
  const total = botScore + humanScore;
  if (total > 0) {
    if (botScore >= humanScore + 1.0) {
      actor_type = "likely_bot";
      confidence = Number(Math.min(0.98, 0.55 + (botScore - humanScore) / (total + 3)).toFixed(2));
    } else if (humanScore >= botScore + 1.0) {
      actor_type = "likely_human";
      confidence = Number(Math.min(0.95, 0.55 + (humanScore - botScore) / (total + 3)).toFixed(2));
    } else {
      actor_type = "unknown";
      confidence = 0.5;
    }
  }

  // Skill level: low | medium | high
  let skill_level = "low";
  const highHits = cmds.filter((c) => HIGH_SKILL_REGEX.test(c.command)).length;
  if (highHits > 0) {
    skill_level = "high";
    reasons.push("Skill high: targeted config/credential/lateral commands");
  } else if (actor_type !== "likely_bot" && cmds.length >= 2) {
    skill_level = "medium";
  } else if (cmds.length >= 4 && actor_type === "likely_bot") {
    skill_level = "low";
  }

  if (reasons.length === 0) reasons.push("Insufficient session commands for classification");

  return {
    actor_type,
    confidence,
    reasons: reasons.slice(0, 5),
    skill_level,
    heuristic_note: "heuristic, tested on lab sessions",
  };
}

const SKILL_ALLOWED_ACTIONS = {
  low: ["maintain", "observe_only"],
  medium: ["maintain", "observe_only", "plant_breadcrumb"],
  high: ["maintain", "observe_only", "plant_breadcrumb", "escalate_tier"],
};

function applySkillMask(action, skillLevel = "high") {
  const allowed = SKILL_ALLOWED_ACTIONS[skillLevel] || SKILL_ALLOWED_ACTIONS.high;
  if (allowed.includes(action)) {
    return { action, masked: false };
  }
  // Safe downgrade: if escalate_tier is masked for medium, step down to plant_breadcrumb; for low, observe_only
  const fallback = skillLevel === "medium" ? "plant_breadcrumb" : "observe_only";
  return { action: fallback, masked: true, raw_action: action };
}

module.exports = { classifySession, applySkillMask, SKILL_ALLOWED_ACTIONS };
