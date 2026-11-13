# Simulator evaluation (500 episodes per policy)

| Policy | Avg reward (95% CI) | Avg steps | Avg techniques | Attacker left or scared off |
|---|---|---|---|---|
| PPO (trained) | +82.21 +/- 3.42 | 40.0 | 23.44 | 0% |
| Always maintain | -1.60 +/- 0.00 | 12.0 | 0.00 | 100% |
| Always plant_breadcrumb | +64.24 +/- 5.29 | 30.9 | 23.44 | 41% |
| Random | +19.57 +/- 2.04 | 29.4 | 7.84 | 60% |
| Oracle rule (knows attacker type) | +85.19 +/- 3.11 | 40.0 | 23.44 | 0% |

## Average reward by attacker type

| Policy | scanner | script_kiddie | advanced |
|---|---|---|---|
| PPO (trained) | +35.80 | +115.00 | +115.00 |
| Always maintain | -1.60 | -1.60 | -1.60 |
| Always plant_breadcrumb | -7.60 | +115.00 | +115.00 |
| Random | -3.13 | +28.86 | +44.95 |
| Oracle rule (knows attacker type) | +43.00 | +115.00 | +115.00 |

## Limitations

- All numbers come from a simulator that we wrote ourselves. They are not results from real attackers.
- The reward formula is our own choice, so the model learns what that formula rewards.
- In the simulator, plant_breadcrumb is almost always the best action against non-scanners (same reward for PPO, always-breadcrumb and the rule). The decision reduces to "is this a scanner or not".
- A simple hand-written rule scores about the same as the trained PPO (+85.19 vs +82.21, overlapping 95% intervals). PPO did not beat the rule.
- The simulator sets some features directly from the attacker type, so the model can read the type from the observation. Real features will be noisier.
- Real data is small: only lab testing, and the decoys saw few real events.
- The "Why" shown on the dashboard is rule-based text, not an explanation from the model.
- The decoy action is only recorded in MongoDB. No fake file is actually created inside Cowrie yet.
