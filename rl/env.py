"""
Honeynet Adaptive RL Environment (Gymnasium).
Uses the shared 25-feature vector from rl/features.json.
Simulates attacker dynamics: skill, engagement, frustration, suspicion.
"""

import json
import os
from typing import Any, Dict, Tuple
import numpy as np

try:
    import gymnasium as gym
    from gymnasium import spaces
except ImportError:
    import gym
    from gym import spaces


class HoneynetEnv(gym.Env):
    metadata = {"render_modes": ["human"]}

    def __init__(self, features_json_path: str = None):
        super().__init__()

        if features_json_path is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            features_json_path = os.path.join(base_dir, "features.json")
            if not os.path.exists(features_json_path):
                features_json_path = os.path.join(base_dir, "..", "features.json")

        with open(features_json_path, "r", encoding="utf-8-sig") as f:
            self.spec = json.load(f)

        self.num_features = self.spec["total_features"]
        self.action_names = self.spec["actions"]

        self.action_space = spaces.Discrete(len(self.action_names))
        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(self.num_features,),
            dtype=np.float32,
        )

        self.feature_ranges = [f["range"] for f in self.spec["features"]]
        self.max_steps = 40
        self.current_step = 0
        self.raw_features = np.zeros(self.num_features, dtype=np.float32)

        self.attacker_profile = "scanner"
        self.engagement = 0.5
        self.suspicion = 0.0
        self.frustration = 0.0
        self.revealed_techniques = set()

    def _get_obs(self) -> np.ndarray:
        normalized = np.zeros(self.num_features, dtype=np.float32)
        for i, (min_v, max_v) in enumerate(self.feature_ranges):
            span = max_v - min_v if max_v > min_v else 1.0
            val = np.clip(self.raw_features[i], min_v, max_v)
            normalized[i] = (val - min_v) / span
        return normalized

    def reset(self, seed: int = None, options: Dict[str, Any] = None) -> Tuple[np.ndarray, Dict[str, Any]]:
        super().reset(seed=seed)
        self.current_step = 0

        rand_val = np.random.rand()
        if rand_val < 0.40:
            self.attacker_profile = "scanner"
            self.engagement = 0.3
            self.suspicion = 0.05
        elif rand_val < 0.75:
            self.attacker_profile = "script_kiddie"
            self.engagement = 0.5
            self.suspicion = 0.1
        else:
            self.attacker_profile = "advanced"
            self.engagement = 0.8
            self.suspicion = 0.15

        self.frustration = 0.0
        self.revealed_techniques = set()

        self.raw_features = np.zeros(self.num_features, dtype=np.float32)
        self.raw_features[4] = 1.0
        self.raw_features[1] = 1.0
        self.raw_features[15] = 1.0
        self.raw_features[16] = 1.0

        if self.attacker_profile == "scanner":
            self.raw_features[23] = 1.0
            self.raw_features[18] = 1.0
            self.raw_features[24] = 1.0
        elif self.attacker_profile == "script_kiddie":
            self.raw_features[17] = 1.0
            self.raw_features[5] = float(np.random.randint(1, 5))
            self.raw_features[24] = 2.0
        else:
            self.raw_features[17] = 1.0
            self.raw_features[8] = 1.0
            self.raw_features[24] = 4.0

        obs = self._get_obs()
        info = {"attacker_profile": self.attacker_profile, "engagement": self.engagement}
        return obs, info

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        self.current_step += 1
        reward = 0.0
        new_tech = 0

        if action == 0:  # maintain
            self.frustration += 0.08
            reward += 0.2
        elif action == 1:  # escalate_tier
            reward -= 0.3
            if self.attacker_profile == "advanced":
                self.engagement = min(1.0, self.engagement + 0.25)
                self.frustration = max(0.0, self.frustration - 0.2)
                if np.random.rand() < 0.70:
                    new_tech += 1
                    reward += 2.5
            elif self.attacker_profile == "script_kiddie":
                self.engagement = min(1.0, self.engagement + 0.15)
                if np.random.rand() < 0.40:
                    new_tech += 1
                    reward += 1.8
            else:
                self.suspicion += 0.15
                reward -= 0.5
        elif action == 2:  # plant_breadcrumb
            reward -= 0.2
            if self.attacker_profile in ["script_kiddie", "advanced"]:
                self.engagement = min(1.0, self.engagement + 0.30)
                self.frustration = max(0.0, self.frustration - 0.3)
                new_tech += 1
                reward += 3.0
            else:
                self.frustration += 0.05
        elif action == 3:  # observe_only
            if self.attacker_profile == "scanner":
                reward += 1.0
                self.engagement = min(1.0, self.engagement + 0.1)
            else:
                self.frustration += 0.15
                reward += 0.1

        self.raw_features[0] += float(np.random.uniform(5.0, 25.0))
        self.raw_features[1] += float(np.random.randint(1, 4))
        self.raw_features[2] = float(self.raw_features[1] / max(0.1, self.raw_features[0] / 60.0))
        self.raw_features[3] = float(np.random.uniform(1.0, 15.0))

        if new_tech > 0:
            tech_idx = len(self.revealed_techniques) + 1
            self.revealed_techniques.add(f"T100{tech_idx}")
            self.raw_features[20] = float(len(self.revealed_techniques))
            self.raw_features[21] = min(10.0, 1.0 + float(len(self.revealed_techniques) // 2))

        if action in [1, 2] and self.attacker_profile != "scanner":
            self.raw_features[10] += float(np.random.randint(1, 3))
            self.raw_features[11] += 1.0
            self.raw_features[12] += float(np.random.choice([0, 1]))
            if action == 2:
                self.raw_features[8] = 1.0
                self.raw_features[22] += 1.0

        self.raw_features[24] = min(10.0, self.raw_features[24] + (0.5 if new_tech else 0.1))

        terminated = False
        truncated = False

        if self.frustration >= 0.90:
            reward -= 4.0
            terminated = True
            self.raw_features[4] = 0.0
        elif self.suspicion >= 0.85:
            reward -= 5.0
            terminated = True
            self.raw_features[4] = 0.0
        elif self.current_step >= self.max_steps:
            reward += 3.0
            truncated = True
            self.raw_features[4] = 0.0

        obs = self._get_obs()
        info = {
            "step": self.current_step,
            "action_taken": self.action_names[action],
            "revealed_techniques_count": len(self.revealed_techniques),
            "engagement": self.engagement,
            "frustration": self.frustration,
            "suspicion": self.suspicion,
        }

        return obs, reward, terminated, truncated, info
