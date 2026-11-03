# Autonomous Adaptive Honeynet

A honeynet is a network of fake systems that attract attackers and record what they do.
This project builds one that adapts itself to the attacker's behavior.

## Status

Phase 2: four decoys running with Docker Compose, each logging to disk.

| Decoy | What it captures | Host port | Log |
|---|---|---|---|
| Cowrie | SSH logins and shell commands | 2222 | `logs/cowrie.json` |
| Web portal (Nginx + Node.js) | Fake admin login attempts | 8080 | `logs/web.json` |
| Heralding | Credentials on FTP and Telnet (16 protocols listen inside the container) | 2121, 2323 | `logs/heralding/auth.csv` |
| Dionaea | SMB connections and malware | 4445 | `dionaea/lib/dionaea/dionaea.json` |

Host ports are chosen to avoid clashing with services on a normal Windows machine.
On a real server they would be the standard ports (22, 80, 21, 23, 445).

## How to run

Requirements: Docker Desktop.

```
docker compose up -d
```

Test each decoy as an "attacker":

```
ssh root@localhost -p 2222
curl.exe -v ftp://admin:pass123@localhost:2121/
Test-NetConnection localhost -Port 4445
```

For the web portal, open http://localhost:8080 and submit the login form.

Logs contain attacker data and are excluded from Git (`.gitignore`).

## Known limitations

- Dionaea's JSON log is enabled by editing `dionaea/etc/`, which is not committed yet.
  A fresh clone will not have it. This will be solved with Kubernetes ConfigMaps in Phase 3.
- Each decoy uses a different log format. A normalizer comes in Phase 4.

## Roadmap

1. Single SSH decoy with logs (done)
2. More decoys: web portal, Heralding, Dionaea (done)
3. Kubernetes deployment
4. Backend and database, log normalization
5. Dashboard with MITRE ATT&CK mapping
6. CRDT sync and RL-based adaptation