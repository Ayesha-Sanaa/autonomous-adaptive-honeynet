# Simulator evaluation (500 episodes per policy)

| Policy | Avg reward (95% CI) | Avg steps | Avg techniques | Attacker left or scared off |
|---|---|---|---|---|
| PPO (trained) | +1.76 +/- 0.27 | 20.2 | 2.82 | 97% |
| Always maintain | -1.58 +/- 0.14 | 17.3 | 0.76 | 100% |
| Always plant_breadcrumb | -0.78 +/- 0.16 | 9.2 | 2.02 | 100% |
| Random | +0.69 +/- 0.48 | 24.5 | 3.61 | 86% |
| Oracle rule (knows attacker type) | +0.22 +/- 0.10 | 9.2 | 2.02 | 100% |
| Always escalate_tier | -6.65 +/- 0.31 | 6.7 | 0.89 | 100% |
| Always observe_only | -1.12 +/- 0.10 | 18.7 | 1.22 | 100% |
| Fair rule (observe if scanner flag, else alternate plant and escalate) | +0.01 +/- 0.27 | 22.1 | 3.54 | 97% |
| PPO (sampling actions) | +3.18 +/- 0.36 | 23.7 | 3.64 | 91% |

## Average reward by attacker type

| Policy | scanner | script_kiddie | advanced |
|---|---|---|---|
| PPO (trained) | +0.00 | +1.06 | +5.68 |
| Always maintain | +0.00 | -3.11 | -2.12 |
| Always plant_breadcrumb | -2.40 | -0.12 | +1.04 |
| Random | -3.48 | -0.42 | +9.25 |
| Oracle rule (knows attacker type) | +0.00 | -0.12 | +1.04 |
| Always escalate_tier | -9.80 | -6.95 | -0.92 |
| Always observe_only | +0.00 | -2.41 | -1.22 |
| Fair rule (observe if scanner flag, else alternate plant and escalate) | +0.00 | -3.31 | +4.61 |
| PPO (sampling actions) | +0.00 | +2.47 | +9.51 |
