# Three arms, same simulator

| Arm | New things found per episode | Steps per episode | Attacker left |
|---|---|---|---|
| Always maintain (no adaptation) | 0.72 +/- 0.12 | 17.0 | 100% |
| Random | 3.84 +/- 0.43 | 24.9 | 82% |
| Fixed rule: observe if scanner, else plant twice then escalate | 3.74 +/- 0.42 | 21.9 | 96% |
| PPO rewarded for session length, 5 seeds | 2.27 (std over seeds 0.46) | 22.3 | 92% |
| PPO rewarded for new behaviour, 5 seeds | 3.70 (std over seeds 0.19) | 23.7 | 89% |
