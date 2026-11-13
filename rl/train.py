"""
Step 3: PPO Training Script for Autonomous Adaptive Honeynet.
Uses stable-baselines3 (PPO with MlpPolicy).
Trains on HoneynetEnv, saves model to rl/ppo_honeynet.zip,
and evaluates trained policy against the Step 2 random baseline.
"""

import os
import sys
import numpy as np

try:
    from stable_baselines3 import PPO
    from stable_baselines3.common.callbacks import BaseCallback
except ImportError:
    print("Error: stable-baselines3 is not installed.")
    print("Please run: python -m pip install stable-baselines3 torch")
    sys.exit(1)

from env import HoneynetEnv


class ProgressCallback(BaseCallback):
    def __init__(self, check_freq: int = 5000, verbose: int = 1):
        super().__init__(verbose)
        self.check_freq = check_freq

    def _on_step(self) -> bool:
        if self.n_calls % self.check_freq == 0:
            if len(self.model.ep_info_buffer) > 0:
                mean_reward = np.mean([ep["r"] for ep in self.model.ep_info_buffer])
                mean_len = np.mean([ep["l"] for ep in self.model.ep_info_buffer])
                print(
                    f"  [Step {self.n_calls:06d}] Mean Ep Reward: {mean_reward:+6.2f} | "
                    f"Mean Ep Length: {mean_len:4.1f} steps"
                )
        return True


def train_and_evaluate(total_timesteps: int = 25000):
    print("=============================================================")
    print("       Step 3: Training PPO Agent on HoneynetEnv            ")
    print("=============================================================")
    print("Algorithm:       PPO (Proximal Policy Optimization)")
    print("Policy Network:  MlpPolicy (25 inputs -> 4 actions)")
    print(f"Total Steps:     {total_timesteps} timesteps (~30-60 seconds on CPU)")
    print("Goal:            Beat Random Baseline (+19.20 average reward)\n")

    env = HoneynetEnv()

    model = PPO(
        policy="MlpPolicy",
        env=env,
        learning_rate=3e-4,
        n_steps=1024,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,
        verbose=0,
    )

    print("Starting training on CPU...\n")
    callback = ProgressCallback(check_freq=5000)
    model.learn(total_timesteps=total_timesteps, callback=callback)
    print("\nTraining completed successfully!")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "ppo_honeynet.zip")
    model.save(model_path)
    print(f"Model saved to: {model_path}\n")

    print("-------------------------------------------------------------")
    print("Evaluating Trained PPO Policy (10 test episodes)...")
    eval_env = HoneynetEnv()
    eval_rewards = []
    eval_steps = []
    eval_techniques = []

    for ep in range(1, 11):
        obs, info = eval_env.reset()
        profile = info.get("attacker_profile", "unknown")
        ep_reward = 0.0
        steps = 0

        while True:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, step_info = eval_env.step(int(action))
            ep_reward += reward
            steps += 1

            if terminated or truncated:
                break

        techs = step_info.get("revealed_techniques_count", 0)
        eval_rewards.append(ep_reward)
        eval_steps.append(steps)
        eval_techniques.append(techs)

        print(
            f"  Test Ep {ep:02d}: Profile={profile:14s} | Steps={steps:02d} | "
            f"Techniques={techs:02d} | Reward={ep_reward:+6.2f}"
        )

    trained_avg_reward = np.mean(eval_rewards)
    trained_avg_steps = np.mean(eval_steps)
    trained_avg_techs = np.mean(eval_techniques)

    print("\n=============================================================")
    print("                     EVALUATION RESULTS                      ")
    print("=============================================================")
    print("Random Baseline Reward:    +19.20")
    print(f"Trained PPO Agent Reward:  {trained_avg_reward:+6.2f}")
    print(f"Avg Session Duration:      {trained_avg_steps:5.1f} steps")
    print(f"Avg Techniques Revealed:   {trained_avg_techs:5.1f}")

    if trained_avg_reward > 19.20:
        improvement = ((trained_avg_reward - 19.20) / max(1.0, abs(19.20))) * 100
        print(f"\nSUCCESS: Trained PPO policy beat Random Actions by +{improvement:.1f}%!")
    else:
        print("\nNote: Retrain with more timesteps if needed.")
    print("=============================================================\n")


if __name__ == "__main__":
    train_and_evaluate(total_timesteps=25000)
