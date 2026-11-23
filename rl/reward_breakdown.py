"""
Where does the reward come from? Runs three policies for 500 episodes each and
adds up each part of the reward per attacker type.
Run from the rl folder:  python reward_breakdown.py
"""
import os
import numpy as np
import torch
from stable_baselines3 import PPO
from env import HoneynetEnv

BASE = os.path.dirname(os.path.abspath(__file__))
EPISODES = 500
model = PPO.load(os.path.join(BASE, "ppo_honeynet.zip"))
env = HoneynetEnv()
PARTS = ["action_cost", "new_lures", "found_alone", "scanner_escalate", "frustration_exit", "suspicion_exit"]

POLICIES = {
    "Random": lambda obs: env.action_space.sample(),
    "Rule B (observe if scanner, else plant twice then escalate)":
        lambda obs: 3 if obs[23] > 0.5 else (1 if env.current_step % 3 == 2 else 2),
    "PPO (sampling)": lambda obs: int(model.predict(obs, deterministic=False)[0]),
}

rows = []
actions_rows = []
for name, pick in POLICIES.items():
    acc = {k: {p: [] for p in PARTS} for k in ("scanner", "script_kiddie", "advanced")}
    tot = {k: [] for k in acc}
    cnt = {k: np.zeros(4) for k in acc}
    for i in range(EPISODES):
        np.random.seed(2000 + i)
        torch.manual_seed(2000 + i)
        env.action_space.seed(2000 + i)
        obs, info = env.reset(seed=2000 + i)
        prof = info["attacker_profile"]
        sums = {p: 0.0 for p in PARTS}
        total = 0.0
        while True:
            a = pick(obs)
            cnt[prof][a] += 1
            obs, r, terminated, truncated, step_info = env.step(a)
            total += r
            for p in PARTS:
                sums[p] += step_info["reward_parts"][p]
            if terminated or truncated:
                break
        for p in PARTS:
            acc[prof][p].append(sums[p])
        tot[prof].append(total)
    for prof in acc:
        vals = " | ".join(f"{np.mean(acc[prof][p]):+.2f}" for p in PARTS)
        rows.append(f"| {name} | {prof} | {vals} | {np.mean(tot[prof]):+.2f} |")
        share = cnt[prof] / max(1.0, cnt[prof].sum())
        actions_rows.append(f"| {name} | {prof} | " + " | ".join(f"{x*100:.0f}%" for x in share) + " |")

out = [
    "# Reward breakdown (average per episode)", "",
    "| Policy | Attacker | " + " | ".join(PARTS) + " | total |",
    "|---|---|" + "---|" * (len(PARTS) + 1), *rows, "",
    "# Share of actions chosen", "",
    "| Policy | Attacker | maintain | escalate_tier | plant_breadcrumb | observe_only |",
    "|---|---|---|---|---|---|", *actions_rows,
]
text = "\n".join(out)
print(text)
with open(os.path.join(BASE, "reward_breakdown.md"), "w", encoding="utf-8") as f:
    f.write(text + "\n")
print("\nSaved: rl/reward_breakdown.md")