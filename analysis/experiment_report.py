"""
S7 Experiment Analysis & Report Generator.
Reads session events + adaptive_decisions + session_meta from MongoDB (or JSON export),
computes log-based novelty/depth metrics per arm, 95% bootstrap CIs, Mann-Whitney U tests,
rank-biserial effect sizes, and saves:
  - results/raw.csv
  - results/summary.md
  - results/arm_comparison.png (if matplotlib available)

Usage:
  python3 analysis/experiment_report.py --mongo mongodb://localhost:27017
  python3 analysis/experiment_report.py --json results/exported_sessions.json
"""

import argparse
import csv
import json
import math
import os
import random
import re
from collections import defaultdict

FILE_READ_RE = re.compile(r"\b(?:cat|head|tail|less|more)\s+(\S+)")


def bootstrap_ci(vals, n_boot=2000, seed=42):
    if not vals:
        return (0.0, 0.0, 0.0)
    mean = sum(vals) / len(vals)
    if len(vals) == 1:
        return (mean, mean, mean)
    rng = random.Random(seed)
    means = []
    n = len(vals)
    for _ in range(n_boot):
        sample = [vals[rng.randrange(n)] for _ in range(n)]
        means.append(sum(sample) / n)
    means.sort()
    return (mean, means[int(0.025 * n_boot)], means[int(0.975 * n_boot)])


def mann_whitney_u(x, y):
    if not x or not y:
        return (None, None, None)
    try:
        from scipy.stats import mannwhitneyu
        res = mannwhitneyu(x, y, alternative="two-sided")
        u, p = float(res.statistic), float(res.pvalue)
    except Exception:
        # Simple pure-Python rank-sum fallback
        u = 0.0
        for a in x:
            for b in y:
                if a > b:
                    u += 1.0
                elif a == b:
                    u += 0.5
        n1, n2 = len(x), len(y)
        mu = n1 * n2 / 2.0
        sd = math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12.0) or 1.0
        z = abs(u - mu) / sd
        p = math.erfc(z / math.sqrt(2.0))
    r_rb = (2.0 * u) / (len(x) * len(y)) - 1.0
    return (round(u, 2), round(p, 5), round(r_rb, 3))


def extract_rows_from_mongo(mongo_url: str):
    from pymongo import MongoClient
    client = MongoClient(mongo_url)
    db = client["honeynet"]
    metas = {m["_id"]: m for m in db["session_meta"].find({})}
    decisions_by_sess = defaultdict(list)
    for d in db["adaptive_decisions"].find({}):
        if d.get("session"):
            decisions_by_sess[d["session"]].append(d)

    events_by_sess = defaultdict(list)
    for e in db["events"].find({"session": {"$ne": None}, "synthetic": {"$ne": True}}):
        events_by_sess[e["session"]].append(e)

    rows = []
    for sid, evs in events_by_sess.items():
        evs.sort(key=lambda e: e.get("timestamp"))
        cmds = [e["command"].strip() for e in evs if e.get("event_type") == "command" and e.get("command")]
        norm_cmds = {c.split()[0] + (" " + c.split()[1] if len(c.split()) > 1 else "") for c in cmds if c}
        files = set()
        for c in cmds:
            for m in FILE_READ_RE.findall(c):
                files.add(m)
        techs = {a["id"] for e in evs for a in (e.get("attack") or []) if a.get("id")}
        ht_hits = sum(1 for e in evs if e.get("honeytoken"))
        meta = metas.get(sid, {})
        decs = decisions_by_sess.get(sid, [])
        arm = meta.get("arm") or (decs[0].get("arm") if decs else "unknown")
        dur = 0
        if len(evs) >= 2 and evs[0].get("timestamp") and evs[-1].get("timestamp"):
            dur = max(0, round((evs[-1]["timestamp"] - evs[0]["timestamp"]).total_seconds(), 2))
        rows.append({
            "session": sid,
            "arm": arm,
            "distinct_commands": len(norm_cmds),
            "total_commands": len(cmds),
            "distinct_techniques": len(techs),
            "files_opened": len(files),
            "duration_s": dur,
            "honeytoken_hits": ht_hits,
        })
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mongo", default="mongodb://localhost:27017")
    ap.add_argument("--json", default="", help="Optional pre-exported JSON array of session rows")
    ap.add_argument("--out-dir", default="results")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    if args.json:
        with open(args.json, "r", encoding="utf-8") as f:
            rows = json.load(f)
    else:
        rows = extract_rows_from_mongo(args.mongo)

    raw_csv = os.path.join(args.out_dir, "raw.csv")
    fields = ["session", "arm", "distinct_commands", "total_commands", "distinct_techniques", "files_opened", "duration_s", "honeytoken_hits"]
    with open(raw_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, 0) for k in fields})

    by_arm = defaultdict(list)
    for r in rows:
        by_arm[r["arm"]].append(r)

    metrics = ["distinct_commands", "distinct_techniques", "files_opened", "duration_s", "honeytoken_hits"]
    lines = ["# GuardNet S7 Experiment Summary\n", f"Total sessions analyzed: **{len(rows)}**\n\n"]
    lines.append("| Arm | N | Distinct Cmds (95% CI) | Techniques (95% CI) | Files Opened (95% CI) | Duration s (95% CI) |\n")
    lines.append("|---|---:|---|---|---|---|\n")

    for arm in sorted(by_arm.keys()):
        grp = by_arm[arm]
        cells = []
        for m in ["distinct_commands", "distinct_techniques", "files_opened", "duration_s"]:
            mean, lo, hi = bootstrap_ci([float(r[m]) for r in grp])
            cells.append(f"{mean:.2f} [{lo:.2f}, {hi:.2f}]")
        lines.append(f"| `{arm}` | {len(grp)} | " + " | ".join(cells) + " |\n")

    if "C_ppo" in by_arm:
        lines.append("\n## Mann-Whitney U Tests vs `C_ppo`\n\n")
        for base in ["A_maintain", "B_fixed_rule"]:
            if base not in by_arm:
                continue
            lines.append(f"### `C_ppo` vs `{base}`\n")
            for m in metrics:
                u, p, r_rb = mann_whitney_u([float(x[m]) for x in by_arm["C_ppo"]], [float(x[m]) for x in by_arm[base]])
                lines.append(f"- `{m}`: U={u}, p={p}, rank-biserial r={r_rb}\n")

    summary_path = os.path.join(args.out_dir, "summary.md")
    with open(summary_path, "w", encoding="utf-8") as f:
        f.writelines(lines)

    try:
        import matplotlib.pyplot as plt
        arms = sorted(by_arm.keys())
        if arms:
            fig, ax = plt.subplots(figsize=(7, 4))
            means = [sum(r["distinct_commands"] for r in by_arm[a]) / len(by_arm[a]) for a in arms]
            ax.bar(arms, means)
            ax.set_ylabel("Mean distinct commands / session")
            ax.set_title("S7 Arm Comparison")
            fig.tight_layout()
            fig.savefig(os.path.join(args.out_dir, "arm_comparison.png"), dpi=150)
            plt.close(fig)
    except Exception:
        pass

    print(f"Wrote {raw_csv} and {summary_path} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
