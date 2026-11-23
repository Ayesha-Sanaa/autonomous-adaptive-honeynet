# Reward breakdown (average per episode)

| Policy | Attacker | action_cost | new_lures | found_alone | scanner_escalate | frustration_exit | suspicion_exit | total |
|---|---|---|---|---|---|---|---|---|
| Random | scanner | -1.45 | +0.00 | +0.00 | -1.48 | +0.00 | -0.70 | -3.64 |
| Random | script_kiddie | -3.90 | +5.53 | +1.51 | +0.00 | -3.85 | +0.00 | -0.72 |
| Random | advanced | -4.75 | +13.30 | +2.81 | +0.00 | -1.74 | -0.27 | +9.36 |
| Rule B (observe if scanner, else plant twice then escalate) | scanner | +0.00 | +0.00 | +0.00 | +0.00 | +0.00 | +0.00 | +0.00 |
| Rule B (observe if scanner, else plant twice then escalate) | script_kiddie | -5.68 | +6.00 | +1.19 | +0.00 | -4.00 | +0.00 | -2.49 |
| Rule B (observe if scanner, else plant twice then escalate) | advanced | -8.06 | +13.97 | +2.62 | +0.00 | -3.41 | +0.00 | +5.11 |
| PPO (sampling) | scanner | +0.00 | +0.00 | +0.00 | +0.00 | +0.00 | +0.00 | +0.00 |
| PPO (sampling) | script_kiddie | -1.01 | +5.81 | +1.72 | +0.00 | -4.00 | +0.00 | +2.51 |
| PPO (sampling) | advanced | -2.89 | +12.05 | +2.82 | +0.00 | -2.57 | -0.31 | +9.10 |

# Share of actions chosen

| Policy | Attacker | maintain | escalate_tier | plant_breadcrumb | observe_only |
|---|---|---|---|---|---|
| Random | scanner | 25% | 25% | 24% | 26% |
| Random | script_kiddie | 23% | 26% | 25% | 25% |
| Random | advanced | 25% | 25% | 26% | 24% |
| Rule B (observe if scanner, else plant twice then escalate) | scanner | 0% | 0% | 0% | 100% |
| Rule B (observe if scanner, else plant twice then escalate) | script_kiddie | 0% | 32% | 68% | 0% |
| Rule B (observe if scanner, else plant twice then escalate) | advanced | 0% | 33% | 67% | 0% |
| PPO (sampling) | scanner | 22% | 0% | 0% | 78% |
| PPO (sampling) | script_kiddie | 0% | 1% | 16% | 82% |
| PPO (sampling) | advanced | 6% | 15% | 19% | 60% |
