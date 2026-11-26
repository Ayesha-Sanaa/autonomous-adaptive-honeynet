import json
import os
import pickle
import time

SRC = "/cowrie/cowrie-git/src/cowrie/data/fs.pickle"
DST = "/fs/custom-fs.pickle"
NOW = time.time()
DAY = 86400

TOKEN_CANDIDATES = [
    "/tokens/honeytokens.json",
    "/scripts/honeytokens.json",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "honeytokens.json"),
    "/decoys/honeytokens.json",
]


def load_tokens():
    for path in TOKEN_CANDIDATES:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {t["id"]: t for t in data.get("tokens", [])}
    return {}


TOKENS = load_tokens()
DB_BACKUP_PASS = TOKENS.get("ht-db-backup-01", {}).get("value", "B4ckup#Alder2024!")
APP_DB_PASS = TOKENS.get("ht-app-db-02", {}).get("value", "InvSvc!94Alder")

with open(SRC, "rb") as f:
    fs = pickle.load(f, encoding="utf8")


def child(node, name):
    for c in node[7]:
        if c[0] == name:
            return c
    return None


def remove_child(node, name):
    c = child(node, name)
    if c:
        node[7].remove(c)
        return True
    return False


def add_dir(parent, name, uid, gid, mode=0o40755, age=30):
    existing = child(parent, name)
    if existing:
        return existing
    node = [name, 1, uid, gid, 4096, mode, NOW - age * DAY, [], None, None]
    parent[7].append(node)
    return node


def add_file(parent, name, data, uid, gid, mode=0o100644, age=10, size=None):
    if isinstance(data, str):
        data = data.encode()
    old = child(parent, name)
    if old:
        parent[7].remove(old)
    node = [name, 2, uid, gid, size if size is not None else len(data), mode, NOW - age * DAY, data, None, None]
    parent[7].append(node)
    return node


def ensure_path(root, parts, uid=0, gid=0):
    node = root
    for p in parts:
        node = add_dir(node, p, uid, gid)
    return node


# Remove default Cowrie 'phil' user from home and /etc/passwd if present
home = child(fs, "home")
if home:
    remove_child(home, "phil")

USERS = [("admin", 1001), ("ubuntu", 1002), ("pi", 1003), ("user", 1004), ("test", 1005)]

passwd = child(child(fs, "etc"), "passwd")
if passwd and isinstance(passwd[7], bytes):
    lines = [
        ln for ln in passwd[7].decode().splitlines()
        if ln.strip() and not ln.startswith("phil:")
    ]
    text = "\n".join(lines) + "\n"
    for user, uid in USERS:
        if f"{user}:x:" not in text:
            text += f"{user}:x:{uid}:{uid}:,,,:/home/{user}:/bin/bash\n"
    passwd[7] = text.encode()
    passwd[4] = len(passwd[7])

# Set believable Alder Freight Ltd hostname (jump01)
etc = child(fs, "etc")
if etc:
    add_file(etc, "hostname", "jump01\n", 0, 0, age=280)
    add_file(
        etc,
        "hosts",
        "127.0.0.1\tlocalhost\n"
        "127.0.1.1\tjump01.alderfreight.local\tjump01\n"
        "10.20.0.5\tjump01\n"
        "10.20.0.10\tweb01\n"
        "10.20.0.15\tdb01\n"
        "10.20.0.20\tftp01\n"
        "10.20.0.30\tnas01\n",
        0,
        0,
        age=200,
    )

NOTES = """TODO - Alder Freight IT (jump01)
- rotate the backup user password (still the old one on db01 10.20.0.15)
- move the nightly dump to the new NAS (nas01 10.20.0.30)
- ask Priya about the VPN profile renewal
- patch openssl on jump01 (maintenance window on saturday)
"""

BACKUP = f"""#!/bin/bash
# nightly dump of the inventory db on db01, then copy to nas01
DB_HOST=10.20.0.15
DB_USER=backup
DB_PASS='{DB_BACKUP_PASS}'
mysqldump -h $DB_HOST -u $DB_USER -p"$DB_PASS" inventory | gzip > /var/backups/inventory-$(date +%F).sql.gz
rsync -az /var/backups/ backupsvc@10.20.0.30:/srv/backups/jump01/
"""

HISTORY = """sudo apt update
sudo apt upgrade -y
cd /var/backups
ls -la
./backup.sh
ssh backupsvc@10.20.0.30
mysql -h 10.20.0.15 -u backup -p
sudo systemctl status nginx
tail -n 50 /var/log/syslog
exit
"""

SSHCFG = """Host db01
    HostName 10.20.0.15
    User backup
Host nas01
    HostName 10.20.0.30
    User backupsvc
Host web01
    HostName 10.20.0.10
    User admin
Host jump01
    HostName 10.20.0.5
    User admin
"""

KNOWN = "10.20.0.15 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPlaceholderHostKeyNotReal0000000000000000\n"

APPCFG = f"""app:
  name: inventory-app
  company: Alder Freight Ltd
  port: 8081
database:
  host: 10.20.0.15
  user: inventory_svc
  password: {APP_DB_PASS}
  name: inventory
"""

CRON = "30 2 * * * admin /home/admin/backup.sh\n"

AUTH_LOG = """Oct 24 02:30:01 jump01 CRON[18421]: pam_unix(cron:session): session opened for user admin(uid=1001) by (uid=0)
Oct 24 02:30:19 jump01 CRON[18421]: pam_unix(cron:session): session closed for user admin
Oct 26 09:14:22 jump01 sshd[20114]: Accepted publickey for admin from 10.20.0.10 port 51924 ssh2: ED25519 SHA256:AlderAdminKey2024
Oct 27 17:41:08 jump01 sudo:    admin : TTY=pts/0 ; PWD=/home/admin ; USER=root ; COMMAND=/usr/bin/apt update
Oct 28 02:30:01 jump01 CRON[22410]: pam_unix(cron:session): session opened for user admin(uid=1001) by (uid=0)
Oct 28 02:30:14 jump01 CRON[22410]: pam_unix(cron:session): session closed for user admin
"""

SYSLOG = """Oct 28 02:30:01 jump01 CRON[22410]: (admin) CMD (/home/admin/backup.sh)
Oct 28 02:30:14 jump01 systemd[1]: Started Daily inventory backup check.
Oct 28 06:12:04 jump01 systemd[1]: Starting Daily apt download activities...
Oct 28 06:12:09 jump01 systemd[1]: apt-daily.service: Deactivated successfully.
Oct 28 11:45:19 jump01 sshd[23891]: Server listening on 0.0.0.0 port 22.
"""

NGINX_ACCESS = """10.20.0.5 - admin [27/Oct/2024:14:20:11 +0000] "GET / HTTP/1.1" 200 1842 "-" "Mozilla/5.0"
10.20.0.30 - priya [28/Oct/2024:09:05:44 +0000] "GET /inventory HTTP/1.1" 200 4120 "http://web01:8081/" "Mozilla/5.0"
"""

for user, uid in USERS:
    h = add_dir(home, user, uid, uid, mode=0o40750, age=90)
    if user == "admin":
        add_file(h, "notes.txt", NOTES, uid, uid, age=6)
        add_file(h, "backup.sh", BACKUP, uid, uid, mode=0o100755, age=19)
        add_file(h, "inventory-2024-10-28.sql.gz", b"", uid, uid, age=17, size=48213342)
        add_file(h, ".bash_history", HISTORY, uid, uid, mode=0o100600, age=1)
        ssh = add_dir(h, ".ssh", uid, uid, mode=0o40700, age=70)
        add_file(ssh, "config", SSHCFG, uid, uid, mode=0o100600, age=50)
        add_file(ssh, "known_hosts", KNOWN, uid, uid, mode=0o100644, age=50)
    elif user == "ubuntu":
        add_file(h, ".bash_history", "uname -a\ndf -h\ncat /etc/hosts\nexit\n", uid, uid, mode=0o100600, age=35)
    else:
        add_file(h, ".bash_history", "ls\npwd\nexit\n", uid, uid, mode=0o100600, age=40)

app = ensure_path(fs, ["opt", "inventory-app"])
add_file(app, "config.yml", APPCFG, 0, 0, mode=0o100644, age=25)
cron = ensure_path(fs, ["etc", "cron.d"])
add_file(cron, "backup", CRON, 0, 0, mode=0o100644, age=60)

var_log = ensure_path(fs, ["var", "log"])
add_file(var_log, "auth.log", AUTH_LOG, 0, 4, mode=0o100640, age=2)
add_file(var_log, "syslog", SYSLOG, 0, 4, mode=0o100640, age=2)
nginx_log = ensure_path(fs, ["var", "log", "nginx"])
add_file(nginx_log, "access.log", NGINX_ACCESS, 0, 4, mode=0o100640, age=2)

with open(DST, "wb") as f:
    pickle.dump(fs, f)

print("custom fs written to", DST)
print("/home:", [c[0] for c in home[7]])
print("/home/admin:", [c[0] for c in child(home, "admin")[7]])
print("/opt/inventory-app:", [c[0] for c in app[7]])
print("/var/log files:", [c[0] for c in var_log[7]])