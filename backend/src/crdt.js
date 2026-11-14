// Small state-based CRDT for attacker knowledge shared between decoys.
// known IPs = G-Set (keys), level = max-register, last = LWW-register,
// counts = G-Counter (per node, merged by max).

function lwwWins(a, b) {
  if (!b) return true;
  if (a.ts !== b.ts) return a.ts > b.ts;
  return a.node > b.node;
}

class CrdtState {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.ips = new Map();
  }

  _rec(ip) {
    if (!this.ips.has(ip)) this.ips.set(ip, { level: 0, last: null, counts: {} });
    return this.ips.get(ip);
  }

  observe(ip, { level = 1, ts = Date.now(), decoy = null } = {}) {
    const r = this._rec(ip);
    r.level = Math.max(r.level, level);
    const cand = { ts, node: this.nodeId, decoy };
    if (lwwWins(cand, r.last)) r.last = cand;
    r.counts[this.nodeId] = (r.counts[this.nodeId] || 0) + 1;
  }

  merge(remote) {
    for (const [ip, rr] of Object.entries((remote && remote.ips) || {})) {
      const r = this._rec(ip);
      r.level = Math.max(r.level, rr.level || 0);
      if (rr.last && lwwWins(rr.last, r.last)) r.last = rr.last;
      for (const [node, c] of Object.entries(rr.counts || {})) {
        r.counts[node] = Math.max(r.counts[node] || 0, c);
      }
    }
  }

  total(ip) {
    const r = this.ips.get(ip);
    return r ? Object.values(r.counts).reduce((a, b) => a + b, 0) : 0;
  }

  toJSON() {
    const ips = {};
    for (const ip of [...this.ips.keys()].sort()) {
      const r = this.ips.get(ip);
      const counts = {};
      for (const n of Object.keys(r.counts).sort()) counts[n] = r.counts[n];
      ips[ip] = {
        level: r.level,
        last: r.last ? { ts: r.last.ts, node: r.last.node, decoy: r.last.decoy } : null,
        counts,
      };
    }
    return { ips };
  }
}

module.exports = { CrdtState, lwwWins };