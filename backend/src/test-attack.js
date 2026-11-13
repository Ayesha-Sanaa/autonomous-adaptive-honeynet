/**
 * Scripted Fake Attack Test for Step 6.
 */
const { MongoClient } = require("mongodb");
const { mapAttack } = require("./mitre");
const { evaluateAndDecide } = require("./adaptive");

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017";
const TEST_SESSION = `attack-sim-${Date.now()}`;
const TEST_IP = "198.51.100.42";

async function runFakeAttackTest() {
  console.log("=============================================================");
  console.log("       Step 6: Scripted Attack & Adaptive Decision Test      ");
  console.log("=============================================================");

  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db("honeynet");
  const events = db.collection("events");

  console.log(`[1/3] Injecting realistic attack events for session: ${TEST_SESSION}`);

  const now = Date.now();
  const fakeEvents = [
    { timestamp: new Date(now - 40000), decoy: "cowrie", protocol: "ssh", event_type: "connect", src_ip: TEST_IP, session: TEST_SESSION, username: null, password: null, command: null, success: null },
    { timestamp: new Date(now - 30000), decoy: "cowrie", protocol: "ssh", event_type: "login_attempt", src_ip: TEST_IP, session: TEST_SESSION, username: "admin", password: "password123", command: null, success: false },
    { timestamp: new Date(now - 20000), decoy: "cowrie", protocol: "ssh", event_type: "login_attempt", src_ip: TEST_IP, session: TEST_SESSION, username: "root", password: "toorpassword", command: null, success: true },
    { timestamp: new Date(now - 10000), decoy: "cowrie", protocol: "ssh", event_type: "command", src_ip: TEST_IP, session: TEST_SESSION, username: "root", password: null, command: "whoami && uname -a", success: true },
    { timestamp: new Date(now - 2000), decoy: "cowrie", protocol: "ssh", event_type: "command", src_ip: TEST_IP, session: TEST_SESSION, username: "root", password: null, command: "cat /etc/passwd", success: true },
  ];

  for (const ev of fakeEvents) {
    ev.attack = mapAttack(ev);
      ev.synthetic = true;
    ev._id = `sim-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  await events.insertMany(fakeEvents);
  console.log(`  -> Injected ${fakeEvents.length} attack events into MongoDB.`);

  console.log("\n[2/3] Triggering Adaptive RL Engine (Features -> Sidecar -> Decoy Action)...");
  const decision = await evaluateAndDecide(db, { session: TEST_SESSION, src_ip: TEST_IP });

  console.log("\n[3/3] Adaptive Decision Result Stored in MongoDB:");
  console.log("-------------------------------------------------------------");
  console.log(`  Decision ID:        ${decision._id}`);
  console.log(`  Timestamp:          ${decision.timestamp.toISOString()}`);
  console.log(`  Target Session:     ${decision.session}`);
  console.log(`  Target IP:          ${decision.src_ip}`);
  console.log(`  Chosen Action:      ${decision.action.toUpperCase()} (Action ID: ${decision.action_id})`);
  console.log(`  Fallback Used:      ${decision.fallback ? "YES (Warning)" : "NO (Clean Inference)"}`);
  console.log(`  Model Version:      ${decision.model_version}`);
  console.log(`  Top Reasons:        ${decision.top_reasons.join(" | ")}`);
  console.log(`  Decoy Action:       ${JSON.stringify(decision.applied_action)}`);
  console.log("-------------------------------------------------------------");

  const stored = await db.collection("adaptive_decisions").findOne({ _id: decision._id });
  if (stored) {
    console.log("VERIFICATION SUCCESS: Decision document verified in MongoDB collection 'adaptive_decisions'.");
  } else {
    console.log("VERIFICATION FAILED: Decision document not found in MongoDB.");
  }
  console.log("=============================================================\n");

  await client.close();
}

if (require.main === module) {
  runFakeAttackTest().catch(console.error);
}
