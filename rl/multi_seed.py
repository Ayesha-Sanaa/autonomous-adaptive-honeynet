"""
Train PPO with 5 seeds and compare with simple rules on the same episodes.
Run from the rl folder:  python multi_seed.py
"""
import os
import numpy as np
import torch
from stable_baselines3 import PPO
from env import HoneynetEnv

BASE = os.path.dirname(os.path.abspath(__file__))
SEEDS = [0, 1, 2, 3, 4]
STEPS = 100000
EPISODES = 300
OUT_DIR = os.path.join(BASE, "seed_models")
os.makedirs(OUT_DIR, exist_ok=True)


def evaluate(env, pick):
    rewards, techs = [], []
    for i in range(EPISODES):
        np.random.seed(1000 + i)
        env.action_space.seed(1000 + i)
        obs, info = env.reset(seed=1000 + i)
        total = 0.0
        while True:
            obs, r, terminated, truncated, step_info = env.step(pick(obs))
            total += r
            if terminated or truncated:
                break
        rewards.append(total)
        techs.append(step_info["revealed_techniques_count"])
    return np.array(rewards), np.array(techs)


def summarize(name, rewards, techs):
    ci = 1.96 * rewards.std() / np.sqrt(len(rewards))
    return f"| {name} | {rewards.mean():+.2f} +/- {ci:.2f} | {techs.mean():.2f} |"


env = HoneynetEnv()
lines = ["| Policy | Avg reward (95% CI) | Avg new techniques |", "|---|---|---|"]

rules = {
    "Random": lambda obs: env.action_space.sample(),
    "Always plant_breadcrumb": lambda obs: 2,
    "Rule A: observe if scanner, else alternate plant and escalate":
        lambda obs: 3 if obs[23] > 0.5 else (2 if env.current_step % 2 == 0 else 1),
    "Rule B: observe if scanner, else plant twice then escalate":
        lambda obs: 3 if obs[23] > 0.5 else (1 if env.current_step % 3 == 2 else 2),
}
for name, pick in rules.items():
    r, t = evaluate(env, pick)
    lines.append(summarize(name, r, t))

det_means, samp_means, det_t, samp_t = [], [], [], []
for s in SEEDS:
    print(f"training seed {s} ...", flush=True)
    model = PPO("MlpPolicy", HoneynetEnv(), learning_rate=3e-4, n_steps=1024, seed=s, verbose=0)
    model.learn(total_timesteps=STEPS)
    model.save(os.path.join(OUT_DIR, f"ppo_seed{s}.zip"))
    torch.manual_seed(123)
    r, t = evaluate(env, lambda obs: int(model.predict(obs, deterministic=True)[0]))
    det_means.append(r.mean()); det_t.append(t.mean())
    r, t = evaluate(env, lambda obs: int(model.predict(obs, deterministic=False)[0]))
    samp_means.append(r.mean()); samp_t.append(t.mean())
    print(f"  seed {s}: deterministic {det_means[-1]:+.2f}, sampling {samp_means[-1]:+.2f}", flush=True)

lines.append(f"| PPO deterministic, {len(SEEDS)} seeds | {np.mean(det_means):+.2f} (std over seeds {np.std(det_means):.2f}) | {np.mean(det_t):.2f} |")
lines.append(f"| PPO sampling, {len(SEEDS)} seeds | {np.mean(samp_means):+.2f} (std over seeds {np.std(samp_means):.2f}) | {np.mean(samp_t):.2f} |")

text = "\n".join(lines)
print("\n" + text)
with open(os.path.join(BASE, "multi_seed_results.md"), "w", encoding="utf-8") as f:
    f.write(text + "\n")
print("\nSaved: rl/multi_seed_results.md")