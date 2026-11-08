# Autonomous Adaptive Honeynet

A honeynet is a network of fake systems that attract attackers and record what they do.
This project builds one that adapts itself to the attacker's behavior.

## Status

Phase 4: four decoys run on a local Kubernetes cluster (kind). Their logs are normalized to one format,
stored in MongoDB by a collector, and served by an API.

```
decoy logs  ->  normalizers  ->  collector  ->  MongoDB  ->  API
```

| Decoy | What it captures | Host port | Log |
|---|---|---|---|
| Cowrie | SSH logins and shell commands | 2222 | `logs/cowrie/cowrie.json` |
| Web portal (Nginx + Node.js) | Fake admin login attempts | 8080 | `logs/web-portal/web.json` |
| Heralding | Credentials on FTP and Telnet (16 protocols listen inside the pod) | 2121, 2323 | `logs/heralding/auth.csv` |
| Dionaea | SMB connections and malware | 4445 | `logs/dionaea/lib/dionaea/dionaea.json` |

Host ports avoid clashing with services on a normal Windows machine and are bound to `127.0.0.1` only.

## How to run (Kubernetes)

Requirements: Docker Desktop, `kind`, `kubectl`.

1. Open `k8s/kind-config.yaml` and set `hostPath` to the absolute path of this repo's `logs` folder.
2. Build the backend image, create the cluster if needed, load the image and deploy, all in one step:

```
.\up.cmd
```

The collector and API use a local image, so `up.cmd` rebuilds and loads it every time.

3. Test each decoy as an "attacker":

```
ssh root@localhost -p 2222
curl.exe -v ftp://admin:pass123@localhost:2121/
Test-NetConnection localhost -Port 4445
```

For the web portal, open http://localhost:8080 and submit the login form.

4. Ask the API what was collected (it is only reachable inside the cluster):

```
kubectl exec -n honeynet deploy/api -- wget -qO- http://localhost:3001/stats
kubectl exec -n honeynet deploy/api -- wget -qO- "http://localhost:3001/events?decoy=cowrie&limit=5"
```

Logs contain attacker data and are excluded from Git (`.gitignore`).

Tear down: `kind delete cluster --name honeynet`

## Repository layout

```
decoys/        one folder per decoy: its files and Kubernetes manifest
backend/
  src/         collector, API, normalizers (one per decoy)
  deploy/      MongoDB, collector and API manifests
k8s/           cluster-level files (kind config, namespace)
logs/          attacker data, one folder per decoy (not in Git)
up.cmd         one command: build, create cluster if missing, load image, deploy
```

## Docker Compose (fallback)

`docker-compose.yml` runs the four decoys without Kubernetes (no database or API):

```
docker compose up -d
```

Do not run Compose and the kind cluster at the same time: they use the same host ports.
The Compose path does not enable Dionaea's JSON log; the Kubernetes path does.

## Known limitations

- MongoDB has no password, and the API has no authentication. Both are reachable only inside the cluster.
- Normalizers cover the events seen so far. Dionaea malware and login events have not been observed yet.
- Source IPs in the logs are the cluster gateway when testing from the same laptop.
  On a real server they would be the attacker's address.

## Roadmap phases

1. Single SSH decoy with logs (done)
2. More decoys: web portal, Heralding, Dionaea (done)
3. Kubernetes deployment (done)
4. Log normalization, MongoDB, collector and API (done)
5. Dashboard with MITRE ATT&CK mapping
6. CRDT sync and RL-based adaptation