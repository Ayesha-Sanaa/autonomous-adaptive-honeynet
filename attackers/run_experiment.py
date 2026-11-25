"""
S7 Lab Experiment Runner.
Executes scripted attacker profiles paced safely under HAProxy rate limits.

Usage:
  python3 attackers/run_experiment.py --n 40 --profiles all --host 127.0.0.1 --port 2222
"""

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from profiles import run_advanced, run_scanner, run_script_kiddie, run_spray

PROFILE_FNS = {
    "scanner": run_scanner,
    "spray": run_spray,
    "script_kiddie": run_script_kiddie,
    "advanced": run_advanced,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=40, help="Sessions per profile per arm")
    ap.add_argument("--profiles", default="all", help="Comma-separated profiles or 'all'")
    ap.add_argument("--arms", type=int, default=3, help="Number of arms (default 3: A, B, C)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=2222)
    ap.add_argument("--pace", type=float, default=1.1, help="Seconds between session starts")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="results/runner_log.jsonl")
    args = ap.parse_args()

    selected = list(PROFILE_FNS.keys()) if args.profiles == "all" else [p.strip() for p in args.profiles.split(",") if p.strip()]
    total_runs = args.n * args.arms
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    rng = random.Random(args.seed)

    schedule = []
    for prof in selected:
        for i in range(total_runs):
            schedule.append((prof, args.seed + i))
    rng.shuffle(schedule)

    print(f"Starting S7 experiment: {len(schedule)} sessions across profiles={selected}, pace={args.pace}s")
    with open(args.out, "a", encoding="utf-8") as logf:
        for idx, (prof, sess_seed) in enumerate(schedule, 1):
            t0 = time.time()
            try:
                res = PROFILE_FNS[prof](args.host, args.port, random.Random(sess_seed))
                res["ok"] = True
            except Exception as err:
                res = {"profile": prof, "ok": False, "error": str(err)}
            res["idx"] = idx
            res["seed"] = sess_seed
            res["timestamp"] = datetime.now(timezone.utc).isoformat()
            logf.write(json.dumps(res) + "\n")
            logf.flush()
            if idx % 10 == 0 or idx == len(schedule):
                print(f"[{idx}/{len(schedule)}] last={prof} ok={res['ok']}")
            elapsed = time.time() - t0
            if elapsed < args.pace:
                time.sleep(args.pace - elapsed)


if __name__ == "__main__":
    main()
