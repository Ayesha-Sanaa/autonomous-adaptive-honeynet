const fs = require("fs");

const NORMALIZERS = {
  cowrie: require("./normalizers/cowrie"),
};

const [decoy, file] = process.argv.slice(2);
const normalize = NORMALIZERS[decoy];
if (!normalize || !file) {
  console.error(`usage: node backend/normalize.js <${Object.keys(NORMALIZERS).join("|")}> <logfile>`);
  process.exit(1);
}

const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
let events = 0;
let bad = 0;
for (const line of lines) {
  let e;
  try {
    e = JSON.parse(line);
  } catch {
    bad++;
    continue;
  }
  const n = normalize(e);
  if (n) {
    const { raw, ...preview } = n;
    console.log(JSON.stringify(preview));
    events++;
  }
}
console.error(`${lines.length} lines read, ${events} events normalized, ${bad} unparseable`);