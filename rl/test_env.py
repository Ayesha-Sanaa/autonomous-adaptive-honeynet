"""
Test script for HoneynetEnv.
Executes random actions over multiple episodes and computes the average reward.
"""

import numpy as np
from env import HoneynetEnv


def test_random_policy(num_episodes: int = 5):
    print(f"=== Testing HoneynetEnv with Random Actions ({num_episodes} episodes) ===\n")
    env = HoneynetEnv()

    total_rewards = []
    total_steps = []
    total_techniques = []

    for ep in range(1, num_episodes + 1):
        obs, info = env.reset()
        profile = info.get("attacker_profile", "unknown")
        ep_reward = 0.0
        steps = 0

        while True:
            action = env.action_space.sample()
            obs, reward, terminated, truncated, step_info = env.step(action)
            ep_reward += reward
            steps += 1

            if terminated or truncated:
                break

        techs = step_info.get("revealed_techniques_count", 0)
        total_rewards.append(ep_reward)
        total_steps.append(steps)
        total_techniques.append(techs)

        print(
            f"Episode {ep:02d}: Profile={profile:14s} | Steps={steps:02d} | "
            f"Techniques Revealed={techs:02d} | Total Reward={ep_reward:+6.2f}"
        )

    avg_reward = np.mean(total_rewards)
    avg_steps = np.mean(total_steps)
    avg_techs = np.mean(total_techniques)

    print("\n-------------------------------------------------------------")
    print("Random Policy Benchmark Results:")
    print(f"  Average Reward per Episode:     {avg_reward:+6.2f}")
    print(f"  Average Steps per Episode:      {avg_steps:5.1f} steps")
    print(f"  Average Techniques Revealed:    {avg_techs:5.1f}")
    print("-------------------------------------------------------------")
    print("Baseline test completed successfully.\n")


if __name__ == "__main__":
    test_random_policy(num_episodes=5)
