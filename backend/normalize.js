const fs = require("fs");

const NORMALIZERS = {
  cowrie: require("./normalizers/cowrie"),
  "web-portal": require("./normalizers/web-portal"),
  heralding: require("./normalizers/heralding"),
  dionaea: require("./normalizers/dionaea"),
};

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { fields.push(cur); cur = ""; }
    else cur += c;
  }
  fields.push(cur);
  return fields;
}

function readRecords(file, lines) {
  if (lines.length === 0) return [];
  if (file.endsWith(".csv")) {
    const header = parseCsvLine(lines[0]);
    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      return Object.fromEntries(header.map((h, i) => [h, values[i] ?? ""]));
    });
  }
  return lines.map((line) => {
    try { return JSON.parse(line); } catch { return undefined; }
  });
}

const [decoy, file] = process.argv.slice(2);
const normalize = NORMALIZERS[decoy];
if (!normalize || !file) {
  console.error(`usage: node backend/normalize.js <${Object.keys(NORMALIZERS).join("|")}> <logfile>`);
  process.exit(1);
}

const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
const records = readRecords(file, lines);
let events = 0;
let bad = 0;
for (const r of records) {
  if (!r) { bad++; continue; }
  const n = normalize(r);
  if (n) {
    const { raw, ...preview } = n;
    console.log(JSON.stringify(preview));
    events++;
  }
}
console.error(`${records.length} records read, ${events} events normalized, ${bad} unparseable`);