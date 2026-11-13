"""
Step 5: RL Sidecar Microservice.
Loads ppo_honeynet.onnx, reads 25 features vector, returns 1 of 4 actions.
Hard rule compliance:
- If ONNX file is missing or inference fails, falls back gracefully to 'maintain'.
- Only returns one of the 4 fixed actions: maintain, escalate_tier, plant_breadcrumb, observe_only.
- Logs every decision with timestamp, IP/session, action, and fallback status.
"""

import json
import logging
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from datetime import datetime, timezone
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

PORT = int(os.environ.get("PORT", 5000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
def resolve_path(var, name):
    for p in [os.environ.get(var, ''), os.path.join(BASE_DIR, name), os.path.join(BASE_DIR, '..', name), name]:
        if p and os.path.exists(p): return p
    return name
MODEL_PATH = resolve_path('MODEL_PATH', 'ppo_honeynet.onnx')
FEATURES_PATH = resolve_path('FEATURES_PATH', 'features.json')

ACTIONS = ["maintain", "escalate_tier", "plant_breadcrumb", "observe_only"]
FALLBACK_ACTION = "maintain"
FALLBACK_ACTION_ID = 0

ort_session = None
model_loaded = False
features_spec = None

try:
    if os.path.exists(FEATURES_PATH):
        with open(FEATURES_PATH, "r", encoding="utf-8-sig") as f:
            features_spec = json.load(f)
            logging.info(f"Loaded features spec from {FEATURES_PATH}")

    if os.path.exists(MODEL_PATH):
        import onnxruntime as ort
        ort_session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
        model_loaded = True
        logging.info(f"Loaded ONNX model successfully from {MODEL_PATH}")
    else:
        logging.warning(f"Model file '{MODEL_PATH}' not found! System will fallback to '{FALLBACK_ACTION}'.")
except Exception as e:
    logging.error(f"Failed to load ONNX model: {e}. Fallback active.")
    model_loaded = False


def predict_action(features_list, session_id="unknown", src_ip="unknown"):
    now_iso = datetime.now(timezone.utc).isoformat()

    if not model_loaded or ort_session is None:
        logging.warning(f"[FALLBACK] Model unavailable. Decision=maintain for IP={src_ip}")
        return {
            "action": FALLBACK_ACTION,
            "action_id": FALLBACK_ACTION_ID,
            "fallback": True,
            "reason": "model_not_loaded",
            "model_version": "fallback-1.0",
            "timestamp": now_iso,
        }

    try:
        if not isinstance(features_list, list) or len(features_list) != 25:
            logging.warning("[FALLBACK] Invalid feature vector length. Fallback to maintain.")
            return {
                "action": FALLBACK_ACTION,
                "action_id": FALLBACK_ACTION_ID,
                "fallback": True,
                "reason": "invalid_features_shape",
                "model_version": "ppo-v1.0",
                "timestamp": now_iso,
            }

        input_array = np.array(features_list, dtype=np.float32).reshape(1, 25)
        outputs = ort_session.run(["action", "logits"], {"observation": input_array})
        action_idx = int(outputs[0][0])
        logits = [float(x) for x in outputs[1][0]]

        if action_idx < 0 or action_idx >= len(ACTIONS):
            action_idx = FALLBACK_ACTION_ID

        action_name = ACTIONS[action_idx]

        logging.info(f"[DECISION] Action={action_name} ({action_idx}) | IP={src_ip} | Session={session_id}")

        return {
            "action": action_name,
            "action_id": action_idx,
            "fallback": False,
            "model_version": "ppo-v1.0",
            "logits": logits,
            "timestamp": now_iso,
        }

    except Exception as err:
        logging.error(f"[FALLBACK] Prediction error: {err}. Safe fallback to maintain.")
        return {
            "action": FALLBACK_ACTION,
            "action_id": FALLBACK_ACTION_ID,
            "fallback": True,
            "reason": str(err),
            "model_version": "ppo-v1.0",
            "timestamp": now_iso,
        }


class SidecarHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {
                "status": "healthy",
                "model_loaded": model_loaded,
                "fallback_mode": not model_loaded,
                "total_features": 25,
                "actions": ACTIONS,
            })
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path == "/predict":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                raw_body = self.rfile.read(content_length).decode("utf-8")
                payload = json.loads(raw_body)

                features = payload.get("features", [])
                session_id = payload.get("session_id", "unknown")
                src_ip = payload.get("src_ip", "unknown")

                result = predict_action(features, session_id=session_id, src_ip=src_ip)
                self._send_json(200, result)
            except Exception as err:
                logging.error(f"Request error: {err}")
                self._send_json(200, {
                    "action": FALLBACK_ACTION,
                    "action_id": FALLBACK_ACTION_ID,
                    "fallback": True,
                    "reason": "malformed_request",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
        else:
            self._send_json(404, {"error": "not found"})

    def log_message(self, format, *args):
        pass


def run_server():
    server = HTTPServer(("0.0.0.0", PORT), SidecarHandler)
    logging.info(f"RL Sidecar Service running on port {PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()


if __name__ == "__main__":
    run_server()
