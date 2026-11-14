import pickle
import time

SRC = "/cowrie/cowrie-git/src/cowrie/data/fs.pickle"
DST = "/fs/custom-fs.pickle"
NOW = time.time()
DAY = 86400

with open(SRC, "rb") as f:
    fs = pickle.load(f, encoding="utf8")


def child(node, name):
    for c in node[7]:
        if c[0] == name:
            return c
    return None


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


USERS = [("admin", 1001), ("ubuntu", 1002), ("pi", 1003), ("user", 1004), ("test", 1005)]

# make the new users exist in /etc/passwd
passwd = child(child(fs, "etc"), "passwd")
if passwd and isinstance(passwd[7], bytes):
    text = passwd[7].decode()
    for user, uid in USERS:
        if f"{user}:x:" not in text:
            text += f"{user}:x:{uid}:{uid}:,,,:/home/{user}:/bin/bash\n"
    passwd[7] = text.encode()
    passwd[4] = len(passwd[7])

home = child(fs, "home")

NOTES = """TODO
- rotate the backup user password (still the old one on the db host)
- move the nightly dump to the new NAS (10.20.0.30)
- ask Priya about the VPN profile renewal
- patch openssl on svr04 (maintenance window on saturday)
"""

BACKUP = """#!/bin/bash
# nightly dump of the inventory db, then copy to the backup host
DB_HOST=10.20.0.15
DB_USER=backup
DB_PASS='B4ckup#2024'
mysqldump -h $DB_HOST -u $DB_USER -p"$DB_PASS" inventory | gzip > /var/backups/inventory-$(date +%F).sql.gz
rsync -az /var/backups/ backupsvc@10.20.0.30:/srv/backups/svr04/
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
Host jump
    HostName 10.20.0.5
    User admin
"""

KNOWN = "10.20.0.15 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPlaceholderHostKeyNotReal0000000000000000\n"

APPCFG = """app:
  name: inventory
  port: 8081
database:
  host: 10.20.0.15
  user: backup
  password: B4ckup#2024
  name: inventory
"""

CRON = "30 2 * * * admin /home/admin/backup.sh\n"

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
    else:
        add_file(h, ".bash_history", "ls\nexit\n", uid, uid, mode=0o100600, age=40)

app = ensure_path(fs, ["opt", "inventory-app"])
add_file(app, "config.yml", APPCFG, 0, 0, mode=0o100644, age=25)
cron = ensure_path(fs, ["etc", "cron.d"])
add_file(cron, "backup", CRON, 0, 0, mode=0o100644, age=60)

with open(DST, "wb") as f:
    pickle.dump(fs, f)

print("custom fs written to", DST)
print("/home/admin:", [c[0] for c in child(home, "admin")[7]])
print("/opt/inventory-app:", [c[0] for c in app[7]])
print("/etc/cron.d:", [c[0] for c in cron[7]])