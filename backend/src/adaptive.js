/**
 * Adaptive Decision Controller.
 * Interacts with RL sidecar (or experiment arm policy), enforces fallback & skill mask,
 * stores decisions in MongoDB, and records decoy actions (verified separately by actuation log).
 */

const http = require("http");
const { extractSessionFeatures } = require("./features");
const { applySkillMask } = require("./actor");

const SIDECAR_URL = process.env.SIDECAR_URL || "http://localhost:5000";
const ALLOWED_ACTIONS = ["maintain", "escalate_tier", "plant_breadcrumb", "observe_only"];
const LIVE_ACTIONS_ENABLED = process.env.LIVE_ACTIONS !== "0";

async function callSidecar(payload) {
  const first = await callSidecarOnce(payload);
  if (!first.fallback) return first;
  await new Promise((r) => setTimeout(r, 1500));
  return callSidecarOnce(payload, 4000);
}

function callSidecarOnce(payload, timeoutMs = 2500) {
  return new Promise((resolve) => {
    try {
      const url = new URL("/predict", SIDECAR_URL);
      const data = JSON.stringify(payload);

      const req = http.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data),
          },
          timeout: timeoutMs,
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(fallbackDecision("unparseable_sidecar_response"));
            }
          });
        }
      );

      req.on("error", (err) => resolve(fallbackDecision(`sidecar_unreachable: ${err.message}`)));
      req.on("timeout", () => {
        req.destroy();
        resolve(fallbackDecision("sidecar_timeout"));
      });

      req.write(data);
      req.end();
    } catch (err) {
      resolve(fallbackDecision(err.message));
    }
  });
}

function fallbackDecision(reason) {
  return {
    action: "maintain",
    action_id: 0,
    fallback: true,
    reason,
    model_version: "fallback-1.0",
    timestamp: new Date().toISOString(),
  };
}

// Arm B fixed rule matching simulator baseline
function fixedRuleDecision(rawFeatures) {
  if (rawFeatures[13] > 0 || rawFeatures[14] > 0) {
    return { action: "escalate_tier", fallback: false, reason: "fixed_rule: download_or_evasion", model_version: "fixed-rule-1.0" };
  }
  if (rawFeatures[12] >= 2) {
    return { action: "plant_breadcrumb", fallback: false, reason: "fixed_rule: recon_commands", model_version: "fixed-rule-1.0" };
  }
  if (rawFeatures[8] === 1 && rawFeatures[10] > 0) {
    return { action: "observe_only", fallback: false, reason: "fixed_rule: post_login_watch", model_version: "fixed-rule-1.0" };
  }
  return { action: "maintain", fallback: false, reason: "fixed_rule: baseline", model_version: "fixed-rule-1.0" };
}

function getTopReasons(rawFeatures) {
  const reasons = [];
  if (rawFeatures[13] > 0) reasons.push(`${rawFeatures[13]} payload download attempts`);
  if (rawFeatures[14] > 0) reasons.push(`${rawFeatures[14]} evasion commands`);
  if (rawFeatures[12] > 0) reasons.push(`${rawFeatures[12]} reconnaissance commands`);
  if (rawFeatures[8] === 1) reasons.push("Valid credential login achieved");
  if (rawFeatures[5] > 3) reasons.push(`High password brute force (${rawFeatures[5]} attempts)`);
  if (rawFeatures[23] === 1) reasons.push("Multi-decoy active scanning (T1595)");
  if (rawFeatures[15] > 1) reasons.push(`Cross-decoy probing (${rawFeatures[15]} decoys touched)`);

  if (reasons.length === 0) {
    if (rawFeatures[1] > 0) reasons.push(`Interactive session activity (${rawFeatures[1]} events)`);
    else reasons.push("Initial session connection");
  }

  return reasons.slice(0, 3);
}

async function applyDecoyAction(db, action, { src_ip, session, phase, seq }) {
  if (phase === "live" && !LIVE_ACTIONS_ENABLED) {
    return { type: "live_actions_disabled", target_decoy: "cowrie", phase, seq: seq ?? null, verified: false };
  }

  const decoyStateCol = db.collection("decoy_state");
  const now = new Date();
  let details = {};

  if (action === "plant_breadcrumb") {
    details = {
      type: "fake_credential_planted",
      target_decoy: "cowrie",
      planted_path: "/home/admin/.aws/credentials",
      verified: false,
    };
  } else if (action === "escalate_tier") {
    details = {
      type: "decoy_tier_escalated",
      target_decoy: "cowrie",
      tier: "high_interaction",
      unlocked_features: ["bash_history_db01", "deploy_notes"],
      verified: false,
    };
  } else if (action === "observe_only") {
    details = { type: "passive_monitoring_mode", target_decoy: "cowrie", alerts_suppressed: false, verified: false };
  } else {
    details = { type: "baseline_maintained", target_decoy: "cowrie", verified: false };
  }

  await decoyStateCol.updateOne(
    { target: session || src_ip },
    { $set: { last_action: action, updated_at: now, details } },
    { upsert: true }
  );

  return details;
}

async function evaluateAndDecide(
  db,
  { session, src_ip, phase = "final", seq = null, latency_ms = null, skill_level = "high", arm = "C_ppo" }
) {
  const decisionsCol = db.collection("adaptive_decisions");
  const featureData = await extractSessionFeatures(db, { session, src_ip });

  let sidecarResponse;
  if (arm === "A_maintain") {
    sidecarResponse = { action: "maintain", fallback: false, reason: "arm_A_maintain", model_version: "arm-A-maintain" };
  } else if (arm === "B_fixed_rule") {
    sidecarResponse = fixedRuleDecision(featureData.raw);
  } else {
    sidecarResponse = await callSidecar({
      features: featureData.normalized,
      session_id: session || "unknown",
      src_ip: src_ip || featureData.src_ip || "unknown",
    });
  }

  const valid = ALLOWED_ACTIONS.includes(sidecarResponse.action);
  const rawAction = valid ? sidecarResponse.action : "maintain";
  const maskedResult = phase === "live" ? applySkillMask(rawAction, skill_level) : { action: rawAction, masked: false };
  const action = maskedResult.action;
  const actionId = ALLOWED_ACTIONS.indexOf(action);
  const appliedDetails = await applyDecoyAction(db, action, {
    session,
    src_ip: featureData.src_ip,
    phase,
    seq,
  });
  const topReasons = getTopReasons(featureData.raw);

  const decisionDoc = {
    timestamp: new Date(),
    src_ip: featureData.src_ip || src_ip || "unknown",
    session: session || featureData.session || null,
    phase,
    seq,
    latency_ms,
    arm,
    skill_level,
    skill_mask_applied: Boolean(maskedResult.masked),
    raw_action: rawAction,
    action,
    action_id: actionId,
    fallback: !valid || sidecarResponse.fallback || false,
    reason: valid ? (sidecarResponse.reason || topReasons.join(", ")) : "invalid_action_from_sidecar",
    model_version: sidecarResponse.model_version || "ppo-v2.0",
    logits: sidecarResponse.logits || [],
    top_reasons: topReasons,
    features_raw: featureData.raw,
    features_normalized: featureData.normalized,
    applied_action: appliedDetails,
  };

  const insertResult = await decisionsCol.insertOne(decisionDoc);
  decisionDoc._id = insertResult.insertedId;

  return decisionDoc;
}

module.exports = { evaluateAndDecide, applyDecoyAction, getTopReasons, ALLOWED_ACTIONS };