const test = require("node:test");
const assert = require("node:assert/strict");
const { CrdtState } = require("./crdt");

function makeRand(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function randomState(node, rand) {
  const st = new CrdtState(node);
  const n = Math.floor(rand() * 8);
  for (let i = 0; i < n; i++) {
    st.observe(`10.0.0.${Math.floor(rand() * 5)}`, {
      level: 1 + Math.floor(rand() * 4),
      ts: Math.floor(rand() * 1000),
      decoy: node,
    });
  }
  return st;
}

const snap = (s) => JSON.stringify(s.toJSON());

function merged(base, ...others) {
  const x = new CrdtState("tmp");
  x.merge(base.toJSON());
  for (const o of others) x.merge(o.toJSON());
  return x;
}

test("merge is commutative, associative and idempotent (300 random cases)", () => {
  const rand = makeRand(42);
  for (let i = 0; i < 300; i++) {
    const a = randomState("cowrie", rand);
    const b = randomState("web-portal", rand);
    const c = randomState("dionaea", rand);
    assert.equal(snap(merged(a, b)), snap(merged(b, a)), "commutative");
    assert.equal(snap(merged(merged(a, b), c)), snap(merged(a, merged(b, c))), "associative");
    assert.equal(snap(merged(a, a)), snap(a), "idempotent");
  }
});

test("observe: level only goes up, count adds, last-write wins", () => {
  const s = new CrdtState("cowrie");
  s.observe("1.2.3.4", { level: 3, ts: 100, decoy: "cowrie" });
  s.observe("1.2.3.4", { level: 1, ts: 200, decoy: "cowrie" });
  const r = s.toJSON().ips["1.2.3.4"];
  assert.equal(r.level, 3);
  assert.equal(r.last.ts, 200);
  assert.equal(s.total("1.2.3.4"), 2);
});

test("partition then heal: both sides converge to the same state", () => {
  const cowrie = new CrdtState("cowrie");
  const web = new CrdtState("web-portal");
  cowrie.observe("9.9.9.9", { level: 4, ts: 10, decoy: "cowrie" });
  web.observe("9.9.9.9", { level: 1, ts: 20, decoy: "web-portal" });
  web.observe("8.8.8.8", { level: 2, ts: 30, decoy: "web-portal" });
  assert.notEqual(snap(cowrie), snap(web));
  cowrie.merge(web.toJSON());
  web.merge(cowrie.toJSON());
  assert.equal(snap(cowrie), snap(web));
  const r = cowrie.toJSON().ips["9.9.9.9"];
  assert.equal(r.level, 4);
  assert.equal(r.last.decoy, "web-portal");
  assert.equal(cowrie.total("9.9.9.9"), 2);
});