# GuardNet Silver Runbook & Verification Checklist (S0–S9)

> **Rule 4 & 5:** Until S2 actuation logs confirm an action in your live pod (`applied_action.verified: true`), refer to actions as **recorded**, not **applied**. Cluster-runtime steps below marked **VERIFY** must be executed on your local Docker / `kind` / `kubectl` environment and their outputs saved.

## S0. Prepare
1. Tag Bronze:
   ```powershell
   git tag -a bronze-1 -m "Bronze complete"
   git push origin bronze-1
   ```
2. **VERIFY** running pod image digests:
   ```powershell
   kubectl -n honeynet get pods -o jsonpath='{range .items[*]}{.metadata.name}{"  "}{.status.containerStatuses[*].imageID}{"\n"}{end}'
   ```
3. Confirm no secrets in git:
   ```powershell
   git ls-files | Select-String ".env"
   ```

## S1. Live Decisions (A3)
- Code present in `backend/src/collector.js`, `backend/src/adaptive.js`, `backend/src/features.js`, `backend/src/cowrie-actuator.js`, `backend/src/api.js`, and `frontend/src/app/(app)/dashboard/adaptive/page.tsx`.
- **VERIFY** with an interactive SSH session (`ssh admin@localhost -p 2222`, password `admin`) typing 6 commands ~3s apart and querying `adaptive_decisions` (`phase: "live"`, `seq`, `latency_ms`) + `/adaptive/stats`.

## S2. Real Actions in Cowrie (A4)
1. **VERIFY** `honeypot.py`, `fs.py`, and `sleep.py` inside the pinned Cowrie pod (see `DECISION_NOTE_S2.md`).
2. Extract & patch `honeypot.py` using `tools/patch_cowrie_honeypot.py`, mount `decoys/cowrie/actuation_hook.py` + patched `honeypot.py` into `/cowrie/cowrie-git/src/cowrie/shell/`, and verify `actuation.json` is written under `logs/cowrie/actuation.json`.
3. `backend/src/normalizers/cowrie-actuation.js` and `backend/src/collector.js` mark `applied_action.verified = true` only when `actuation.json` confirms it.

## S3. Believable Cowrie (C2)
- `decoys/cowrie/build-fs.py` removes `phil`, sets `jump01` & `/etc/hosts` from `STORY.md`, injects `/var/log/auth.log`, `/var/log/syslog`, `/var/log/nginx/access.log`, and reads `decoys/honeytokens.json`.
- `decoys/cowrie/cowrie.yaml` sets `COWRIE_SHELL_*` and `COWRIE_SSH_VERSION` env vars (VERIFY against `cowrie.cfg.dist` in pod) and mounts `cmdoutput.json`.
- **VERIFY** before/after with:
  ```powershell
  python3 tools/honeypot_checks.py --host 127.0.0.1 --port 2222 --out results/giveaways_after.json
  python3 tools/command_coverage.py --host 127.0.0.1 --port 2222 --out results/coverage.json
  ```

## S4. Web Portal (C3)
- `decoys/web-portal/capture/server.js` logs all requests (`web.request`, `web.login.attempt`), serves Alder Freight Ltd login, weak creds, lockout, inner pages (`/portal`, `/portal/users`, `/portal/notices`, `/portal/backup-download`), and lures (`/robots.txt`, `/admin`, `/backup.zip`, `/.git/HEAD`, `/.git/config`).
- `backend/src/mitre.js` maps 404/lure hits to `T1595`.

## S5. Honeytokens & MariaDB (C4)
- Single source of truth: `decoys/honeytokens.json`.
- Isolated MariaDB decoy: `decoys/mariadb/mariadb.yaml` + `k8s/network-policies.yaml` (`mariadb-isolation`) + `backend/src/normalizers/mariadb.js`.
- Collector inserts `honeytoken_hits`; API serves `GET /honeytokens`; Overview & Attacker pages render hits.

## S6. Bot or Human & Skill Level (D1)
- `backend/src/normalizers/cowrie.js` keeps `client_version` and `kex_hassh`.
- `backend/src/actor.js` computes `actor_type`, `confidence`, `reasons`, and `skill_level`, persisted in `session_meta`.
- `backend/src/adaptive.js` enforces the skill mask (`low` -> `maintain`/`observe_only`, `medium` -> +`plant_breadcrumb`, `high` -> +`escalate_tier`).

## S7. Lab Experiment (B2)
- Preregistration: `analysis/PREREG.md`.
- **VERIFY** by setting `EXPERIMENT_MODE=1` on `collector` deployment and running:
  ```powershell
  python3 attackers/run_experiment.py --n 40 --profiles all --host 127.0.0.1 --port 2222
  python3 analysis/experiment_report.py --mongo mongodb://localhost:27017
  ```

## S8. Security Hardening (F2)
- Create real `honeynet-secrets` (based on `k8s/secrets.example.yaml`) and enable MongoDB `--auth` after taking a backup.
- `CRDT_TOKEN` enforces `x-crdt-token` across sidecars and `api.js`.
- `backend/src/auth.js` records `login_failures` with 15-min TTL + 5-failure lockout, plus rate limits on `/auth/login`, `/auth/signup`, `POST /reports`.
- **VERIFY** secrets/image scans locally:
  ```powershell
  docker run --rm -v ${PWD}:/repo zricethezav/gitleaks:latest detect --source /repo
  ```

## S9. Reliability & Operations (G1)
- Readiness/liveness probes and resource limits added to deployments.
- Collector persists offsets (`OFFSETS_FILE`), CRDT sidecars persist state (`STATE_FILE` every 10s + shutdown).
- Daily `mongodump` CronJob in `backend/deploy/mongodb-backup-cronjob.yaml`.
- Operations dashboard live at `/dashboard/ops` backed by `GET /ops`.
