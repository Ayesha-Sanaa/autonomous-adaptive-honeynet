@echo off
cd /d "%~dp0"

docker info >nul 2>&1 || (echo Docker Desktop is not running. Start it and try again. & exit /b 1)

echo [1/5] Building backend image
docker build -t honeynet-backend:dev -f backend/Dockerfile . || exit /b 1
echo [2/5] Building RL sidecar image
docker build -t honeynet-rl:dev -f rl/sidecar/Dockerfile rl || exit /b 1

echo [3/5] Cluster
docker container inspect honeynet-control-plane >nul 2>&1
if errorlevel 1 (
  kind create cluster --name honeynet --config k8s\kind-config.yaml || exit /b 1
) else (
  docker start honeynet-control-plane >nul
)

echo [4/5] Loading images into the cluster
kind load docker-image honeynet-backend:dev --name honeynet || exit /b 1
kind load docker-image honeynet-rl:dev --name honeynet || exit /b 1

echo [5/5] Deploying
kubectl apply -k . || exit /b 1
kubectl rollout restart deployment/collector -n honeynet
kubectl rollout restart deployment/api -n honeynet
kubectl rollout restart deployment/rl-sidecar -n honeynet
kubectl rollout status deployment/collector -n honeynet --timeout=180s
kubectl rollout status deployment/api -n honeynet --timeout=180s
kubectl rollout status deployment/rl-sidecar -n honeynet --timeout=180s
kubectl wait --for=condition=available deployment --all -n honeynet --timeout=300s