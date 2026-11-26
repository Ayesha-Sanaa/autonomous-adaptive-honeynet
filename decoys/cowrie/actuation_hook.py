"""
S2 Cowrie live actuation helper.
Loaded by patched honeypot.py to read /actions/<session>.json, apply live session
effects on the virtual filesystem (or non-blocking Twisted delay), and log proof to
/cowrie/cowrie-git/var/log/cowrie/actuation.json.
"""

import json
import os
import random
import time
from datetime import datetime, timezone

ACTIONS_DIR = os.environ.get("ACTIONS_DIR", "/actions")
ACTUATION_LOG = os.environ.get(
    "ACTUATION_LOG", "/cowrie/cowrie-git/var/log/cowrie/actuation.json"
)


def _safe_session(session_id: str) -> str:
    cleaned = "".join(
        ch if (ch.isalnum() or ch in "._-") else "_" for ch in str(session_id or "")
    )
    return (cleaned or "unknown")[:64]


def _ensure_parent_dirs(fs, path: str, uid: int = 1001, gid: int = 1001):
    parts = [p for p in path.split("/") if p][:-1]
    cur = ""
    for p in parts:
        cur = f"{cur}/{p}"
        if not fs.exists(cur):
            fs.mkdir(cur, uid, gid, 4096, 0o40755)


def _write_virtual_file(fs, path: str, content: str, uid: int = 1001, gid: int = 1001):
    data = content.encode("utf-8") if isinstance(content, str) else content
    _ensure_parent_dirs(fs, path, uid=uid, gid=gid)
    if fs.exists(path):
        fobj = fs.getfile(path)
        # Update Cowrie A_CONTENTS (index 7) and A_SIZE (index 4)
        fobj[7] = data
        fobj[4] = len(data)
        fobj[6] = time.time()
    else:
        fs.mkfile(path, uid, gid, len(data), 0o100644)
        fobj = fs.getfile(path)
        fobj[7] = data


def _append_virtual_file(fs, path: str, extra: str, uid: int = 1001, gid: int = 1001):
    existing = b""
    if fs.exists(path):
        fobj = fs.getfile(path)
        if isinstance(fobj[7], (bytes, bytearray)):
            existing = bytes(fobj[7])
    _write_virtual_file(fs, path, existing.decode("utf-8", "ignore") + extra, uid=uid, gid=gid)


def _log_actuation(session: str, action: str, seq, effect: dict):
    record = {
        "eventid": "cowrie.actuation.applied",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session": str(session),
        "action": str(action),
        "seq": seq,
        "effect": effect,
        "verified": True,
    }
    try:
        os.makedirs(os.path.dirname(ACTUATION_LOG), exist_ok=True)
        with open(ACTUATION_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
    except Exception:
        pass


def consume_and_apply(shell):
    """
    Inspect /actions/<session>.json for the active Cowrie shell.
    Returns delay_seconds (float) if observe_only delay should be scheduled.
    """
    try:
        session_id = getattr(shell.protocol.transport, "sessionno", None)
        if hasattr(shell.protocol, "log") and hasattr(shell.protocol.log, "session"):
            session_id = shell.protocol.log.session
        # Cowrie stores the hex session id on transport.session.id or protocol.sessionId (VERIFY in pod)
        sid = (
            getattr(shell.protocol, "sessionId", None)
            or getattr(getattr(shell.protocol, "transport", None), "sessionno", None)
            or session_id
            or "unknown"
        )
        sid = str(sid)
        action_path = os.path.join(ACTIONS_DIR, f"{_safe_session(sid)}.json")
        if not os.path.exists(action_path):
            return 0.0

        with open(action_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        seq = data.get("seq")
        action = data.get("action", "maintain")
        last_seq = getattr(shell, "_guardnet_last_seq", None)
        if seq is not None and last_seq == seq and action != "observe_only":
            return 0.0
        shell._guardnet_last_seq = seq

        fs = getattr(shell.protocol, "fs", None)
        delay = 0.0

        if action == "observe_only":
            delay = round(random.uniform(0.3, 1.2), 3)
            _log_actuation(sid, action, seq, {"type": "delay", "delay_s": delay})
        elif action == "plant_breadcrumb" and fs is not None:
            planted_path = str(data.get("planted_path") or "/home/admin/.aws/credentials")
            if not planted_path.startswith("/home/"):
                planted_path = "/home/admin/.aws/credentials"
            token_val = data.get("token_value") or "AKIAALDER7FAKE9TOKEN"
            token_id = data.get("token_id") or "ht-aws-key-04"
            token_kind = str(data.get("token_kind") or "api_key")
            token_user = str(data.get("token_username") or "backupsvc")
            if ".aws" in planted_path:
                content = (
                    "[default]\n"
                    f"aws_access_key_id = {token_val}\n"
                    "aws_secret_access_key = alder-decoy-secret-not-real\n"
                )
            elif token_kind == "credential" or "nas" in planted_path:
                content = (
                    "# Alder Freight NAS sync credentials\n"
                    "NAS_HOST=10.20.0.30\n"
                    f"NAS_USER={token_user}\n"
                    f"NAS_PASS={token_val}\n"
                )
            else:
                content = (
                    "# Alder Freight ops deploy token\n"
                    f"DEPLOY_USER={token_user}\n"
                    f"DEPLOY_TOKEN={token_val}\n"
                )
            _write_virtual_file(fs, planted_path, content)
            _log_actuation(
                sid,
                action,
                seq,
                {"type": "breadcrumb_planted", "path": planted_path, "token_id": token_id},
            )
        elif action == "escalate_tier" and fs is not None:
            notes_path = "/opt/inventory-app/deploy-notes.txt"
            _write_virtual_file(
                fs,
                notes_path,
                "Alder Freight DB migration notes (2024-10-28):\n"
                "Primary inventory DB: db01 (10.20.0.15:3306)\n"
                "Nightly dump script: /home/admin/backup.sh\n",
                uid=0,
                gid=0,
            )
            _append_virtual_file(
                fs,
                "/home/admin/.bash_history",
                "mysql -h 10.20.0.15 -u backup -p inventory -e 'SHOW TABLES;'\n",
            )
            _log_actuation(
                sid,
                action,
                seq,
                {"type": "tier_escalated", "exposed_path": notes_path},
            )
        else:
            _log_actuation(sid, "maintain", seq, {"type": "baseline_maintained"})

        return delay
    except Exception:
        return 0.0
