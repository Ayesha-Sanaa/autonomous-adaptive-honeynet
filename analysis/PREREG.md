# Pre-Registration: GuardNet Lab Experiment (S7 / B2)

Written prior to executing `attackers/run_experiment.py`.

## 1. Research Question & Hypothesis
- **Question**: Does the PPO adaptive policy (`ppo-v2.0`, rewarded for attacker novelty) elicit more distinct normalized commands, opened files, and ATT&CK techniques per session than a non-adaptive baseline or a fixed-rule heuristic, all else equal?
- **H1 (Primary)**: Arm C (`C_ppo`) yields a higher mean number of distinct normalized commands and new files opened per session than Arm A (`A_maintain`) on reactive (`advanced`) profiles.
- **H0 (Null)**: No difference across arms.

## 2. Experimental Arms (Assigned Randomly Before First Action)
- **Arm A (`A_maintain`)**: No adaptation; always returns `maintain`.
- **Arm B (`B_fixed_rule`)**: Deterministic rule-based baseline matching the simulator heuristic.
- **Arm C (`C_ppo`)**: Live ONNX policy (`ppo-v2.0`, sampled actions, novelty-rewarded).
- **Arm D (`D_ppo_length`, optional)**: Length-rewarded PPO checkpoints in `rl/`.

## 3. Sample Size & Attacker Profiles
- **Profiles**: `scanner`, `spray`, `script_kiddie`, `advanced` (reactive seeded Paramiko attacker).
- **Sample Size**: `N = 40` sessions per `(arm, profile)` cell (480 sessions for 3 arms x 4 profiles).
- **Pacing**: ~1.0 s delay between connection starts to stay within HAProxy's 60 connections / 10 s rate limit.

## 4. Measures (Computed From Logs, Not Simulator Reward)
- **Primary**:
  1. Distinct normalized commands per session.
  2. Distinct ATT&CK techniques matched per session.
  3. New files opened / read per session (`cat`, `head`, `tail`, `less`).
- **Secondary**:
  - Session duration (`s`), total commands, early exit rate, honeytoken hit count.

## 5. Statistical Analysis
- Group means and 95% non-parametric bootstrap confidence intervals (`B = 2000` resamples).
- Pairwise two-sided Mann-Whitney U tests (`C_ppo` vs `A_maintain`, `C_ppo` vs `B_fixed_rule`) with rank-biserial correlation effect size.
- Outputs generated reproducibly by `analysis/experiment_report.py` into `results/raw.csv`, `results/summary.md`, and PNG figures in `results/`.
