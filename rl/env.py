"""
Honeynet Adaptive RL Environment (Gymnasium), version 2.
Uses the shared 25-feature vector from rl/features.json.

Each attacker type has a limited number of things it can be shown. A new thing
found gives reward. Showing the same kind of lure again and again makes an
advanced attacker suspicious. When nothing new is found the attacker loses
patience. Scanners leave quickly whatever we do, so we do not punish that.
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

# How many new things each attacker type can still be shown.
FILE_LURES = {"scanner": 0, "script_kiddie": 3, "advanced": 4}   # shown by plant_breadcrumb
DEEP_LURES = {"scanner": 0, "script_kiddie": 0, "advanced": 3}   # shown by escalate_tier
NATURAL = {"scanner": 0, "script_kiddie": 2, "advanced": 3}      # the attacker finds alone
NATURAL_P = {"scanner": 0.0, "script_kiddie": 0.06, "advanced": 0.10}
P_FILE = {"script_kiddie": 0.70, "advanced": 0.60}
P_DEEP = {"advanced": 0.55}

ACTION_COST = [0.0, 0.3, 0.2, 0.0]   # maintain, escalate_tier, plant_breadcrumb, observe_only
NEW_THING_REWARD = 2.0
NATURAL_REWARD = 1.0


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
            low=0.0, high=1.0, shape=(self.num_features,), dtype=np.float32
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
        self.file_left = 0
        self.deep_left = 0
        self.natural_left = 0
        self.last_action = -1
        self.repeat = 0

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
            self.engagement, self.suspicion = 0.3, 0.05
        elif rand_val < 0.75:
            self.attacker_profile = "script_kiddie"
            self.engagement, self.suspicion = 0.5, 0.1
        else:
            self.attacker_profile = "advanced"
            self.engagement, self.suspicion = 0.8, 0.15

        p = self.attacker_profile
        self.frustration = 0.0
        self.revealed_techniques = set()
        self.file_left = FILE_LURES[p]
        self.deep_left = DEEP_LURES[p]
        self.natural_left = NATURAL[p]
        self.last_action = -1
        self.repeat = 0

        self.raw_features[:] = 0.0
        self.raw_features[1] = 1.0
        self.raw_features[4] = 1.0   # the session is active while the policy decides
        self.raw_features[15] = 1.0
        self.raw_features[16] = 1.0

        if p == "scanner":
            self.raw_features[23] = 1.0
            self.raw_features[18] = 1.0
            self.raw_features[24] = 1.0
        elif p == "script_kiddie":
            self.raw_features[17] = 1.0
            self.raw_features[5] = float(np.random.randint(1, 5))
            self.raw_features[24] = 2.0
        else:
            self.raw_features[17] = 1.0
            self.raw_features[8] = 1.0
            self.raw_features[24] = 4.0

        obs = self._get_obs()
        info = {"attacker_profile": p, "engagement": self.engagement}
        return obs, info
    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        self.current_step += 1
        p = self.attacker_profile
        reward = -ACTION_COST[action]
        parts = {
            "action_cost": -ACTION_COST[action],
            "new_lures": 0.0,
            "found_alone": 0.0,
            "scanner_escalate": 0.0,
            "frustration_exit": 0.0,
            "suspicion_exit": 0.0,
        }
        new_tech = 0   # found because of our action
        natural = 0    # found by the attacker alone

        if action == self.last_action:
            self.repeat += 1
        else:
            self.repeat = 1
        self.last_action = action

        if action == 2:  # plant_breadcrumb
            if self.file_left > 0 and np.random.rand() < P_FILE.get(p, 0.0):
                self.file_left -= 1
                new_tech = 1
                self.engagement = min(1.0, self.engagement + 0.2)
                self.raw_features[8] = 1.0
                self.raw_features[22] += 1.0
            if p == "scanner":
                self.suspicion += 0.05
        elif action == 1:  # escalate_tier
            if self.deep_left > 0 and np.random.rand() < P_DEEP.get(p, 0.0):
                self.deep_left -= 1
                new_tech = 1
                self.engagement = min(1.0, self.engagement + 0.25)
            if p == "scanner":
                self.suspicion += 0.15
                reward -= 0.5
                parts["scanner_escalate"] -= 0.5

        # Showing the same lure again and again looks fake.
        if action in (1, 2) and p != "scanner" and self.repeat >= 3:
            step_up = 0.10 if p == "advanced" else 0.04
            self.suspicion += step_up * (self.repeat - 2)

        # The attacker may find something alone; observe_only gives it more room.
        if self.natural_left > 0:
            chance = NATURAL_P[p] * (2.0 if action == 3 else 1.0)
            if np.random.rand() < chance:
                self.natural_left -= 1
                natural = 1

        found = new_tech + natural
        reward += NEW_THING_REWARD * new_tech + NATURAL_REWARD * natural
        parts["new_lures"] = NEW_THING_REWARD * new_tech
        parts["found_alone"] = NATURAL_REWARD * natural

        if found > 0:
            self.frustration = max(0.0, self.frustration - 0.25)
        else:
            self.frustration += 0.08 if p == "scanner" else 0.06

        # Update the raw features the policy can see.
        self.raw_features[0] += float(np.random.uniform(5.0, 25.0))
        self.raw_features[1] += float(np.random.randint(1, 4))
        self.raw_features[2] = float(self.raw_features[1] / max(0.1, self.raw_features[0] / 60.0))
        self.raw_features[3] = float(np.random.uniform(1.0, 15.0))

        if found > 0:
            self.revealed_techniques.add(f"sim-novel-{len(self.revealed_techniques) + 1}")
            self.raw_features[20] = float(len(self.revealed_techniques))
            self.raw_features[21] = min(10.0, 1.0 + float(len(self.revealed_techniques) // 2))
            self.raw_features[10] += float(np.random.randint(1, 3))
            self.raw_features[11] += 1.0
            self.raw_features[12] += float(np.random.choice([0, 1]))

        self.raw_features[24] = min(10.0, self.raw_features[24] + (0.5 if found else 0.1))

        terminated = False
        truncated = False

        if self.frustration >= 0.90:
            if p != "scanner":
                reward -= 4.0   # a scanner leaves anyway, so no penalty for it
                parts["frustration_exit"] = -4.0
            terminated = True
            self.raw_features[4] = 0.0
        elif self.suspicion >= 0.85:
            reward -= 5.0
            parts["suspicion_exit"] = -5.0
            terminated = True
            self.raw_features[4] = 0.0
        elif self.current_step >= self.max_steps:
            truncated = True
            self.raw_features[4] = 0.0

        obs = self._get_obs()
        info = {
            "step": self.current_step,
            "action_taken": self.action_names[action],
            "revealed_techniques_count": len(self.revealed_techniques),
            "new_found": found,
            "reward_parts": parts,
            "engagement": self.engagement,
            "frustration": self.frustration,
            "suspicion": self.suspicion,
        }
        return obs, reward, terminated, truncated, info