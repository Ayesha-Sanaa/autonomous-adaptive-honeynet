# Autonomous Adaptive Honeynet

A honeynet is a network of fake systems that attract attackers and record what they do.
This project builds one that adapts itself to the attacker's behavior.



## Status

Phase 3: four decoys running on a local Kubernetes cluster (kind), each logging to disk.

| Decoy | What it captures | Host port | Log |
|---|---|---|---|
| Cowrie | SSH logins and shell commands | 2222 | `logs/cowrie.json` |
| Web portal (Nginx + Node.js) | Fake admin login attempts | 8080 | `logs/web.json` |
| Heralding | Credentials on FTP and Telnet (16 protocols listen inside the pod) | 2121, 2323 | `logs/heralding/auth.csv` |
| Dionaea | SMB connections and malware | 4445 | `logs/dionaea/lib/dionaea/dionaea.json` |

Host ports avoid clashing with services on a normal Windows machine and are bound to `127.0.0.1` only.

## How to run (Kubernetes)

Requirements: Docker Desktop, `kind`, `kubectl`.

1. Open `k8s/kind-config.yaml` and set `hostPath` to the absolute path of this repo's `logs` folder on your machine.
2. Create the cluster and deploy everything:

```
kind create cluster --name honeynet --config k8s\kind-config.yaml
kubectl apply -k .
kubectl get pods -n honeynet
```

3. Test each decoy as an "attacker":

```
ssh root@localhost -p 2222
curl.exe -v ftp://admin:pass123@localhost:2121/
Test-NetConnection localhost -Port 4445
```

For the web portal, open http://localhost:8080 and submit the login form.

Logs contain attacker data and are excluded from Git (`.gitignore`).

Tear down:

```
kind delete cluster --name honeynet
```

## Docker Compose (fallback)

`docker-compose.yml` runs the same decoys without Kubernetes:

```
docker compose up -d
```

Do not run Compose and the kind cluster at the same time: they use the same host ports.
The Compose path does not enable Dionaea's JSON log; the Kubernetes path does.

## Known limitations

- Each decoy uses a different log format. A normalizer comes in Phase 4.
- Source IPs in the logs are the cluster gateway when testing from the same laptop.
  On a real server they would be the attacker's address.

## Roadmap

1. Single SSH decoy with logs (done)
2. More decoys: web portal, Heralding, Dionaea (done)
3. Kubernetes deployment (done)
4. Backend and database, log normalization
5. Dashboard with MITRE ATT&CK mapping
6. CRDT sync and RL-based adaptation