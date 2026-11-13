/**
 * Adaptive Decision Controller.
 * Interacts with RL sidecar, enforces fallback, stores decisions in MongoDB,
 * and safely applies adaptive actions (planting breadcrumbs, adjusting tier, passive observation).
 */

const http = require("http");
const { extractSessionFeatures } = require("./features");

const SIDECAR_URL = process.env.SIDECAR_URL || "http://localhost:5000";
const ALLOWED_ACTIONS = ["maintain", "escalate_tier", "plant_breadcrumb", "observe_only"];

function callSidecar(payload, timeoutMs = 2500) {
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

async function applyDecoyAction(db, action, { src_ip, session }) {
  const decoyStateCol = db.collection("decoy_state");
  const now = new Date();
  let details = {};

  if (action === "plant_breadcrumb") {
    details = {
      type: "fake_credential_planted",
      target_decoy: "cowrie",
      fake_token: `AWS_SECRET_KEY=AKIA${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      planted_path: "/home/root/.aws/credentials",
    };
  } else if (action === "escalate_tier") {
    details = {
      type: "decoy_tier_escalated",
      tier: "high_interaction",
      unlocked_features: ["bash_history", "readable_etc_hosts"],
    };
  } else if (action === "observe_only") {
    details = { type: "passive_monitoring_mode", alerts_suppressed: false };
  } else {
    details = { type: "baseline_maintained" };
  }

  await decoyStateCol.updateOne(
    { target: session || src_ip },
    { $set: { last_action: action, updated_at: now, details } },
    { upsert: true }
  );

  return details;
}

async function evaluateAndDecide(db, { session, src_ip }) {
 
  const decisionsCol = db.collection("adaptive_decisions");
  const featureData = await extractSessionFeatures(db, { session, src_ip });

  const sidecarResponse = await callSidecar({
    features: featureData.normalized,
    session_id: session || "unknown",
    src_ip: src_ip || featureData.src_ip || "unknown",
  });

  const valid = ALLOWED_ACTIONS.includes(sidecarResponse.action);
  const action = valid ? sidecarResponse.action : "maintain";
  const actionId = ALLOWED_ACTIONS.indexOf(action);
  const appliedDetails = await applyDecoyAction(db, action, { session, src_ip: featureData.src_ip });
  const topReasons = getTopReasons(featureData.raw);

   const decisionDoc = {
    timestamp: new Date(),
    src_ip: featureData.src_ip || src_ip || "unknown",
    session: session || featureData.session || null,
    action,
    action_id: actionId,
    fallback: !valid || sidecarResponse.fallback || false,
    reason: valid ? sidecarResponse.reason || null : "invalid_action_from_sidecar",
    model_version: sidecarResponse.model_version || "ppo-v1.0",
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

module.exports = { evaluateAndDecide, applyDecoyAction, getTopReasons };
