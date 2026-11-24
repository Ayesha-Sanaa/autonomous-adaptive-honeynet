"""
Three arms in the same simulator:
  fixed rules, PPO rewarded for session length, PPO rewarded for new behaviour.
Every arm is scored with the same measure: new things found per episode
(never with its own reward). Run from the rl folder:  python arms.py
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


def evaluate(pick):
    env = HoneynetEnv()
    found, steps, left = [], [], 0
    for i in range(EPISODES):
        np.random.seed(5000 + i)
        env.action_space.seed(5000 + i)
        obs, info = env.reset(seed=5000 + i)
        n_found, n_steps = 0, 0
        while True:
            obs, r, terminated, truncated, step_info = env.step(pick(env, obs))
            n_found += step_info["new_found"]
            n_steps += 1
            if terminated or truncated:
                break
        found.append(n_found)
        steps.append(n_steps)
        if terminated:
            left += 1
    return np.array(found), np.array(steps), left / EPISODES


rows = []


def add_row(name, found, steps, left):
    ci = 1.96 * found.std() / np.sqrt(len(found))
    rows.append(f"| {name} | {found.mean():.2f} +/- {ci:.2f} | {steps.mean():.1f} | {left * 100:.0f}% |")


rules = {
    "Always maintain (no adaptation)": lambda env, obs: 0,
    "Random": lambda env, obs: env.action_space.sample(),
    "Fixed rule: observe if scanner, else plant twice then escalate":
        lambda env, obs: 3 if obs[23] > 0.5 else (1 if env.current_step % 3 == 2 else 2),
}
for name, pick in rules.items():
    f, s, l = evaluate(pick)
    add_row(name, f, s, l)

for mode, label in (("length", "PPO rewarded for session length"),
                    ("novelty", "PPO rewarded for new behaviour")):
    sf, ss_, sl = [], [], []
    for sd in SEEDS:
        print(f"training {mode} seed {sd} ...", flush=True)
        model = PPO("MlpPolicy", HoneynetEnv(reward_mode=mode), learning_rate=3e-4,
                    n_steps=1024, seed=sd, verbose=0)
        model.learn(total_timesteps=STEPS)
        model.save(os.path.join(OUT_DIR, f"ppo_{mode}_seed{sd}.zip"))
        torch.manual_seed(123)
        f, s, l = evaluate(lambda env, obs, m=model: int(m.predict(obs, deterministic=False)[0]))
        sf.append(f.mean()); ss_.append(s.mean()); sl.append(l)
        print(f"  seed {sd}: found {f.mean():.2f}, steps {s.mean():.1f}", flush=True)
    rows.append(f"| {label}, {len(SEEDS)} seeds | {np.mean(sf):.2f} (std over seeds {np.std(sf):.2f}) "
                f"| {np.mean(ss_):.1f} | {np.mean(sl) * 100:.0f}% |")

out = ["# Three arms, same simulator", "",
       "| Arm | New things found per episode | Steps per episode | Attacker left |",
       "|---|---|---|---|", *rows]
text = "\n".join(out)
print("\n" + text)
with open(os.path.join(BASE, "arms_results.md"), "w", encoding="utf-8") as f:
    f.write(text + "\n")
print("\nSaved: rl/arms_results.md")