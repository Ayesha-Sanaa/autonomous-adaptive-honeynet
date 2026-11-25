"""
Export the trained PPO model to ONNX and verify it.
The check compares the logits (not only the top action) on the test vectors and on 300 random inputs.
Run from the rl folder:  python export_onnx.py
"""

import os
import sys
import numpy as np
import torch

try:
    from stable_baselines3 import PPO
except ImportError:
    print("Error: stable-baselines3 is not installed.")
    sys.exit(1)

import onnxruntime as ort


class OnnxablePPOPolicy(torch.nn.Module):
    def __init__(self, policy):
        super().__init__()
        self.policy = policy

    def forward(self, observation: torch.Tensor):
        features = self.policy.extract_features(observation)
        latent_pi, _ = self.policy.mlp_extractor(features)
        action_logits = self.policy.action_net(latent_pi)
        action = torch.argmax(action_logits, dim=-1)
        return action, action_logits


def export_and_verify():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "ppo_honeynet.zip")
    onnx_path = os.path.join(base_dir, "ppo_honeynet.onnx")

    if not os.path.exists(model_path):
        print(f"Error: model file not found at {model_path}. Run train.py first.")
        sys.exit(1)

    print(f"Loading trained model: {model_path}")
    model = PPO.load(model_path, device="cpu")
    onnx_policy = OnnxablePPOPolicy(model.policy)
    onnx_policy.eval()

    dummy_input = torch.zeros((1, 25), dtype=torch.float32)
    axes = {"observation": {0: "batch_size"}, "action": {0: "batch_size"}, "logits": {0: "batch_size"}}

    print(f"Exporting to ONNX: {onnx_path}")
    try:
        torch.onnx.export(
            onnx_policy, dummy_input, onnx_path,
            input_names=["observation"], output_names=["action", "logits"],
            dynamic_axes=axes, opset_version=17, dynamo=False,
        )
    except TypeError:
        torch.onnx.export(
            onnx_policy, dummy_input, onnx_path,
            input_names=["observation"], output_names=["action", "logits"],
            dynamic_axes=axes, opset_version=17,
        )
    print("Export done.\n")

    ort_session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])

    vectors = []
    scanner = np.zeros(25, dtype=np.float32); scanner[23] = 1.0; scanner[18] = 1.0
    vectors.append(scanner)
    brute = np.zeros(25, dtype=np.float32); brute[5] = 0.5; brute[17] = 1.0
    vectors.append(brute)
    recon = np.zeros(25, dtype=np.float32); recon[12] = 0.4; recon[8] = 1.0; recon[17] = 1.0
    vectors.append(recon)
    rng = np.random.default_rng(0)
    for _ in range(300):
        v = rng.uniform(0.0, 1.0, 25).astype(np.float32)
        v[rng.random(25) < 0.6] = 0.0
        vectors.append(v)

    max_diff = 0.0
    action_matches = 0
    chosen = [0, 0, 0, 0]
    for vec in vectors:
        orig_action, _ = model.predict(vec, deterministic=True)
        with torch.no_grad():
            _, torch_logits = onnx_policy(torch.tensor(vec).unsqueeze(0))
        out = ort_session.run(["action", "logits"], {"observation": vec.reshape(1, 25)})
        onnx_logits = out[1][0]
        max_diff = max(max_diff, float(np.max(np.abs(torch_logits.numpy()[0] - onnx_logits))))
        if int(orig_action) == int(out[0][0]):
            action_matches += 1
        chosen[int(out[0][0])] += 1

    total = len(vectors)
    print(f"Inputs checked:              {total}")
    print(f"Max logit difference:        {max_diff:.2e}")
    print(f"Top action matches PyTorch:  {action_matches}/{total}")
    print(f"Top action counts (maintain, escalate_tier, plant_breadcrumb, observe_only): {chosen}")
    ok = max_diff < 1e-4 and action_matches == total
    print("\nVERIFICATION " + ("SUCCESS" if ok else "FAILED"))


if __name__ == "__main__":
    export_and_verify()