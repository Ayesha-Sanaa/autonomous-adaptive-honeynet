@echo off
cd /d "%~dp0"

docker info >nul 2>&1 || (echo Docker Desktop is not running. Start it and try again. & exit /b 1)

echo [1/4] Building backend image
docker build -t honeynet-backend:dev backend || exit /b 1

echo [2/4] Cluster
docker container inspect honeynet-control-plane >nul 2>&1
if errorlevel 1 (
  kind create cluster --name honeynet --config k8s\kind-config.yaml || exit /b 1
) else (
  docker start honeynet-control-plane >nul
)

echo [3/4] Loading image into the cluster
kind load docker-image honeynet-backend:dev --name honeynet || exit /b 1

echo [4/4] Deploying
kubectl apply -k . || exit /b 1
kubectl rollout restart deployment/collector -n honeynet
kubectl rollout restart deployment/api -n honeynet
kubectl rollout status deployment/collector -n honeynet --timeout=180s
kubectl rollout status deployment/api -n honeynet --timeout=180s
kubectl wait --for=condition=available deployment --all -n honeynet --timeout=300s
kubectl get pods -n honeynet