"""
S3 Honeypot Giveaway Checker.
Checks SSH banner, hostname, default 'phil' giveaway, uptime, /proc files,
dmesg, ls /, file dates, and reply latency over a real SSH session.

Usage:
  python3 tools/honeypot_checks.py --host 127.0.0.1 --port 2222 --user admin --password admin
"""

import argparse
import json
import socket
import sys
import time


def grab_banner(host: str, port: int) -> str:
    with socket.create_connection((host, port), timeout=5) as s:
        return s.recv(256).decode("utf-8", "ignore").strip()


def run_cmd(shell, cmd: str) -> tuple[str, float]:
    t0 = time.perf_counter()
    shell.send(cmd + "\n")
    time.sleep(0.4)
    out = []
    while shell.recv_ready():
        out.append(shell.recv(8192).decode("utf-8", "ignore"))
        time.sleep(0.05)
    dt_ms = round((time.perf_counter() - t0) * 1000, 1)
    return "".join(out), dt_ms


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

    banner = grab_banner(args.host, args.port)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(args.host, port=args.port, username=args.user, password=args.password, timeout=10, allow_agent=False, look_for_keys=False)
    shell = client.invoke_shell()
    time.sleep(0.5)
    if shell.recv_ready():
        shell.recv(8192)

    probes = [
        ("hostname", "hostname"),
        ("users_home", "ls -la /home"),
        ("passwd", "cat /etc/passwd | tail -n 10"),
        ("uptime", "uptime"),
        ("proc_version", "cat /proc/version"),
        ("proc_cpuinfo", "head -n 6 /proc/cpuinfo"),
        ("dmesg", "dmesg | head -n 5"),
        ("root_ls", "ls -la /"),
        ("admin_dates", "ls -la /home/admin"),
    ]

    checks = []
    for name, cmd in probes:
        out, dt_ms = run_cmd(shell, cmd)
        low = out.lower()
        giveaways = []
        if "cowrie" in low:
            giveaways.append("mentions_cowrie")
        if name in ("users_home", "passwd") and "phil" in low:
            giveaways.append("default_user_phil")
        if name == "hostname" and "svr04" in low:
            giveaways.append("default_hostname_svr04")
        checks.append({
            "check": name,
            "command": cmd,
            "latency_ms": dt_ms,
            "giveaways": giveaways,
            "sample": out.strip()[:160],
        })

    client.close()
    report = {
        "banner": banner,
        "banner_giveaway": "cowrie" in banner.lower(),
        "checks": checks,
        "total_giveaways": sum(len(c["giveaways"]) for c in checks) + (1 if "cowrie" in banner.lower() else 0),
    }
    print(json.dumps(report, indent=2))
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)


if __name__ == "__main__":
    main()
