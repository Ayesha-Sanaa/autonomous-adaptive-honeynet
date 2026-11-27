# Decision Note: S2 Investigation & Patch Plan (honeypot.py & fs.py)

> Status: Code artifacts (`actuation_hook.py`, `patch_cowrie_honeypot.py`, `normalizers/cowrie-actuation.js`) are prepared in the repo. Live Cowrie pod inspection and actuation proof are marked **VERIFY** until executed against the pinned `cowrie/cowrie` container on the cluster.

## 1. Investigation Commands (VERIFY on running Cowrie pod)
Run these commands inside the pinned Cowrie pod (`sha256:115ed9b682dce64a112d6185dcd64c94969599e5b63f13c3e85927a9b2f0292f`) to inspect the exact lines in `honeypot.py` and `fs.py`:

```bash
kubectl exec -n honeynet deploy/cowrie -c cowrie -- grep -nE "def lineReceived|def runCommand|deferLater" /cowrie/cowrie-git/src/cowrie/shell/honeypot.py
kubectl exec -n honeynet deploy/cowrie -c cowrie -- grep -nE "def mkfile|def mkdir|A_CONTENTS" /cowrie/cowrie-git/src/cowrie/shell/fs.py
kubectl exec -n honeynet deploy/cowrie -c cowrie -- grep -n "deferLater" /cowrie/cowrie-git/src/cowrie/commands/sleep.py
```

## 2. Hook Point & Design
- **Where to hook (`honeypot.py`)**: Inside `HoneyPotShell.lineReceived(self, line)` (VERIFY exact method name and indentation in the pinned image) right before `self.runCommand()` / command parsing runs.
- **How actions execute per session**:
  1. Read `/actions/<session>.json` written by `cowrie-actuator` (if present).
  2. Track last applied `(seq, action)` in-memory per shell session so the same `seq` is not re-applied twice.
  3. Apply one of the 4 Silver actions:
     - `maintain`: no filesystem change, no delay.
     - `observe_only`: schedule non-blocking Twisted `reactor.callLater(delay, ...)` (0.3–1.2 s) around command dispatch so Twisted event loop is never blocked. *(Note: in simulator `observe_only` is passive observation; in the lab it adds a realistic 0.3–1.2s delay.)*
     - `plant_breadcrumb`: write the next unused honeytoken file (`token_path`, `token_content` from `/actions/<session>.json` / `honeytokens.json`) into the in-memory `self.protocol.fs` via `fs.mkfile(...)`.
     - `escalate_tier`: create `/opt/inventory-app/deploy-notes.txt` via `fs.mkfile(...)` and append an `ssh`/`mysql` clue pointing to `db01` (`10.20.0.15`) to `/home/admin/.bash_history`.
  4. Append a JSON line to `/cowrie/cowrie-git/var/log/cowrie/actuation.json` (`{timestamp, session, action, seq, effect, verified: true}`) so the collector marks `applied_action.verified = true`.
- **Fallback if patch fails**: Pre-stage files in `build-fs.py` and swap `contents_path` or run a second richer Cowrie instance via HAProxy.
- **Honesty rule**: Until `actuation.json` confirms the action, the dashboard renders `"recorded"`, and only renders `"applied"` when `applied_action.verified === true`.
