FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir onnxruntime numpy
COPY features.json ppo_honeynet.onnx sidecar/server.py ./
EXPOSE 5000
CMD ["python", "server.py"]
