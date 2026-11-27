# GuardNet S7 Experiment Summary
Total sessions analyzed: **3468**

| Arm | N | Distinct Cmds (95% CI) | Techniques (95% CI) | Files Opened (95% CI) | Duration s (95% CI) |
|---|---:|---|---|---|---|
| `A_maintain` | 36 | 0.94 [0.22, 1.83] | 0.94 [0.47, 1.56] | 0.33 [0.00, 0.78] | 22.38 [10.92, 35.73] |
| `B_fixed_rule` | 34 | 0.74 [0.15, 1.47] | 0.76 [0.29, 1.29] | 0.24 [0.00, 0.59] | 15.33 [5.78, 26.81] |
| `C_ppo` | 3383 | 0.04 [0.01, 0.07] | 0.03 [0.02, 0.04] | 0.01 [0.00, 0.02] | 0.41 [0.26, 0.60] |
| `unknown` | 15 | 2.33 [1.27, 3.47] | 1.73 [1.00, 2.47] | 0.40 [0.00, 1.00] | 23.95 [11.80, 38.79] |

## Mann-Whitney U Tests vs `C_ppo`

### `C_ppo` vs `A_maintain`
- `distinct_commands`: U=52672.0, p=0.16284, rank-biserial r=-0.135
- `distinct_techniques`: U=37823.5, p=9e-05, rank-biserial r=-0.379
- `files_opened`: U=55944.0, p=0.4008, rank-biserial r=-0.081
- `duration_s`: U=44210.0, p=0.00463, rank-biserial r=-0.274
- `honeytoken_hits`: U=60894.0, p=1.0, rank-biserial r=0.0
### `C_ppo` vs `B_fixed_rule`
- `distinct_commands`: U=50972.5, p=0.25332, rank-biserial r=-0.114
- `distinct_techniques`: U=39486.0, p=0.00164, rank-biserial r=-0.313
- `files_opened`: U=54246.0, p=0.56839, rank-biserial r=-0.057
- `duration_s`: U=46396.5, p=0.05216, rank-biserial r=-0.193
- `honeytoken_hits`: U=57511.0, p=1.0, rank-biserial r=0.0
