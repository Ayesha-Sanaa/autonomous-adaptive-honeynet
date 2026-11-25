const fs = require("fs");
const path = require("path");

const CANDIDATES = [
  process.env.HONEYTOKENS_PATH || "",
  path.resolve(__dirname, "../../decoys/honeytokens.json"),
  "/decoys/honeytokens.json",
  "/tokens/honeytokens.json",
].filter(Boolean);

let cache = null;

function loadHoneytokens() {
  if (cache) return cache;
  for (const p of CANDIDATES) {
    try {
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
        cache = parsed.tokens || [];
        return cache;
      }
    } catch { /* ignore */ }
  }
  cache = [];
  return cache;
}

function matchHoneytoken(ev) {
  const tokens = loadHoneytokens();
  if (!tokens.length) return null;
  const fields = [
    ["username", ev.username],
    ["password", ev.password],
    ["command", ev.command],
  ];
  for (const t of tokens) {
    if (!t.value) continue;
    for (const [fieldName, fieldVal] of fields) {
      if (typeof fieldVal === "string" && fieldVal.includes(t.value)) {
        return { id: t.id, planted_in: t.planted_in, kind: t.kind, matched_field: fieldName };
      }
    }
  }
  return null;
}

function nextBreadcrumbToken(usedIds = new Set()) {
  const tokens = loadHoneytokens().filter((t) => t.for_breadcrumb);
  if (!tokens.length) {
    return {
      id: "ht-aws-key-04",
      value: "AKIAALDER7FAKE9TOKEN",
      planted_in: "cowrie:/home/admin/.aws/credentials",
    };
  }
  const unused = tokens.find((t) => !usedIds.has(t.id));
  return unused || tokens[0];
}

module.exports = { loadHoneytokens, matchHoneytoken, nextBreadcrumbToken };
