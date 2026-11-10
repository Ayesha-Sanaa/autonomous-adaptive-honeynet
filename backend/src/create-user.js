// Creates an account from inside the cluster, so the password never appears in a command line or in shell history.
// Run:  kubectl exec -it -n honeynet deploy/api -- node create-user.js
const { MongoClient } = require("mongodb");
const auth = require("./auth");

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    let text = "";
    const stdin = process.stdin;
    if (hidden) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\u0003") process.exit(130); // Ctrl+C
        if (ch === "\r" || ch === "\n") {
          stdin.removeListener("data", onData);
          if (hidden) stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write("\n");
          return resolve(text);
        }
        if (ch === "\u007f" || ch === "\b") text = text.slice(0, -1);
                else text += ch;
      }
    };
    stdin.on("data", onData);
  });
}

(async () => {
  if (!process.stdin.isTTY) {
    console.error("Run this with: kubectl exec -it ... (the -it flags are needed to hide the password)");
    process.exit(1);
  }
  const client = new MongoClient(process.env.MONGO_URL || "mongodb://mongodb:27017");
  await client.connect();
  const db = client.db("honeynet");
  await auth.ensureIndexes(db);
  try {
    const username = await ask("Username: ");
    const roleAnswer = (await ask("Role (admin/analyst) [admin]: ")).trim() || "admin";
    const password = await ask("Password (min 12 characters, hidden): ", { hidden: true });
    const again = await ask("Repeat password: ", { hidden: true });
    if (password !== again) throw new auth.HttpError(400, "passwords do not match");
    const created = await auth.createUser(db, { username, password, role: roleAnswer });
    console.log(`Created ${created.role} account "${created.username}".`);
  } catch (err) {
    console.error(err instanceof auth.HttpError ? `Not created: ${err.message}` : err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
})();