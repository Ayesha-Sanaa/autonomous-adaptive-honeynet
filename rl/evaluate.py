"""
Step 8: compare policies on the simulator.
Run from the rl folder:  python evaluate.py
"""
import os
import numpy as np
from stable_baselines3 import PPO
from env import HoneynetEnv

EPISODES = 500
BASE = os.path.dirname(os.path.abspath(__file__))
model = PPO.load(os.path.join(BASE, "ppo_honeynet.zip"))
env = HoneynetEnv()

POLICIES = {
    "PPO (trained)": lambda obs, p: int(model.predict(obs, deterministic=True)[0]),
    "Always maintain": lambda obs, p: 0,
    "Always plant_breadcrumb": lambda obs, p: 2,
    "Random": lambda obs, p: env.action_space.sample(),
    "Oracle rule (knows attacker type)": lambda obs, p: 3 if p == "scanner" else 2,
}


def run(pick):
    rewards, steps, techs, left = [], [], [], 0
    by_profile = {"scanner": [], "script_kiddie": [], "advanced": []}
    for i in range(EPISODES):
        np.random.seed(i)
        env.action_space.seed(i)
        obs, info = env.reset(seed=i)
        profile = info["attacker_profile"]
        total, n = 0.0, 0
        while True:
            obs, r, terminated, truncated, step_info = env.step(pick(obs, profile))
            total += r
            n += 1
            if terminated or truncated:
                break
        rewards.append(total)
        steps.append(n)
        techs.append(step_info["revealed_techniques_count"])
        by_profile[profile].append(total)
        if terminated:
            left += 1
    return rewards, steps, techs, left, by_profile


rows, prof_rows = [], []
for name, pick in POLICIES.items():
    rewards, steps, techs, left, by_profile = run(pick)
    mean = np.mean(rewards)
    ci = 1.96 * np.std(rewards) / np.sqrt(len(rewards))
    rows.append(
        f"| {name} | {mean:+.2f} +/- {ci:.2f} | {np.mean(steps):.1f} | "
        f"{np.mean(techs):.2f} | {left / EPISODES * 100:.0f}% |"
    )
    prof_rows.append(
        f"| {name} | "
        + " | ".join(f"{np.mean(by_profile[k]):+.2f}" for k in by_profile)
        + " |"
    )

out = [
    f"# Simulator evaluation ({EPISODES} episodes per policy)",
    "",
    "| Policy | Avg reward (95% CI) | Avg steps | Avg techniques | Attacker left or scared off |",
    "|---|---|---|---|---|",
    *rows,
    "",
    "## Average reward by attacker type",
    "",
    "| Policy | scanner | script_kiddie | advanced |",
    "|---|---|---|---|",
    *prof_rows,
]
text = "\n".join(out)
print(text)
with open(os.path.join(BASE, "evaluation.md"), "w", encoding="utf-8") as f:
    f.write(text + "\n")
print("\nSaved: rl/evaluation.md")
