"""
S3 Command Coverage Checker.
Connects via Paramiko to Cowrie SSH and runs ~60 common Linux commands,
flagging 'command not found', empty replies, or identical-every-time outputs.

Usage:
  python3 tools/command_coverage.py --host 127.0.0.1 --port 2222 --user admin --password admin
"""

import argparse
import json
import sys
import time

COMMANDS = [
    "uname -a", "uname -r", "uname -m", "hostname", "hostname -f", "hostname -I",
    "id", "whoami", "w", "who", "users", "last", "uptime", "date", "pwd",
    "ls -la", "ls -la /", "ls -la /home", "ls -la /home/admin", "ls -la /opt/inventory-app",
    "cat /etc/os-release", "cat /etc/issue", "cat /etc/hostname", "cat /etc/hosts", "cat /etc/passwd",
    "cat /proc/cpuinfo", "cat /proc/meminfo", "cat /proc/version", "cat /proc/uptime",
    "free -m", "df -h", "lscpu", "ps aux", "ps -ef", "top -b -n 1",
    "ip a", "ip r", "ifconfig", "route -n", "netstat -tulpn", "ss -tulpn", "arp -a",
    "crontab -l", "ls -la /etc/cron.d", "cat /etc/cron.d/backup",
    "systemctl status ssh", "service ssh status", "dmesg | head -n 5",
    "env", "printenv", "which python3", "which curl", "which wget",
    "python3 --version", "mysql --version", "git --version", "git log", "docker ps",
    "cat /var/log/auth.log", "cat /var/log/syslog",
]


def run_cmd(shell, cmd: str, wait_s: float = 0.35) -> str:
    shell.send(cmd + "\n")
    time.sleep(wait_s)
    chunks = []
    while shell.recv_ready():
        chunks.append(shell.recv(8192).decode("utf-8", "ignore"))
        time.sleep(0.05)
    return "".join(chunks)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=2222)
    ap.add_argument("--user", default="admin")
    ap.add_argument("--password", default="admin")
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    try:
        import paramiko
    except ImportError:
        print("Install paramiko first: pip install paramiko", file=sys.stderr)
        sys.exit(2)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(args.host, port=args.port, username=args.user, password=args.password, timeout=10, allow_agent=False, look_for_keys=False)
    shell = client.invoke_shell()
    time.sleep(0.6)
    if shell.recv_ready():
        shell.recv(8192)

    results = []
    seen_bodies = {}
    for cmd in COMMANDS:
        raw = run_cmd(shell, cmd)
        lines = [ln for ln in raw.splitlines() if cmd not in ln and not ln.strip().endswith("$") and not ln.strip().endswith("#")]
        body = "\n".join(lines).strip()
        status = "ok"
        if not body:
            status = "empty"
        elif "command not found" in body.lower():
            status = "not_found"
        elif body in seen_bodies:
            status = f"duplicate_of:{seen_bodies[body]}"
        else:
            seen_bodies[body] = cmd
        results.append({"command": cmd, "status": status, "preview": body[:120]})
        print(f"[{status:12s}] {cmd}")

    client.close()

    summary = {
        "total": len(results),
        "ok": sum(1 for r in results if r["status"] == "ok"),
        "not_found": sum(1 for r in results if r["status"] == "not_found"),
        "empty": sum(1 for r in results if r["status"] == "empty"),
        "duplicate": sum(1 for r in results if r["status"].startswith("duplicate_of")),
        "results": results,
    }
    print(json.dumps({k: v for k, v in summary.items() if k != "results"}, indent=2))
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)


if __name__ == "__main__":
    main()
