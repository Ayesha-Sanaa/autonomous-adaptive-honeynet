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
