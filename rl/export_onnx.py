"""
Step 4: Export trained PPO model to ONNX and verify.
Exports policy with a fixed input shape [1, 25].
Verifies that ONNX Runtime produces the exact same action output as PyTorch.
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

try:
    import onnx
    import onnxruntime as ort
except ImportError:
    print("Notice: onnx or onnxruntime not installed yet.")
    print("Please run: python -m pip install onnx onnxruntime")


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
    print("=============================================================")
    print("       Step 4: Export PPO Model to ONNX & Verify             ")
    print("=============================================================")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "ppo_honeynet.zip")
    onnx_path = os.path.join(base_dir, "ppo_honeynet.onnx")

    if not os.path.exists(model_path):
        print(f"Error: Model file not found at {model_path}. Run Step 3 train.py first.")
        sys.exit(1)

    print(f"Loading trained model: {model_path}")
    model = PPO.load(model_path, device="cpu")
    onnx_policy = OnnxablePPOPolicy(model.policy)
    onnx_policy.eval()

    dummy_input = torch.zeros((1, 25), dtype=torch.float32)

    print(f"Exporting to ONNX: {onnx_path}")
    try:
        torch.onnx.export(
            onnx_policy,
            dummy_input,
            onnx_path,
            input_names=["observation"],
            output_names=["action", "logits"],
            dynamic_axes={"observation": {0: "batch_size"}, "action": {0: "batch_size"}, "logits": {0: "batch_size"}},
            opset_version=17,
            dynamo=False,
        )
    except TypeError:
        torch.onnx.export(
            onnx_policy,
            dummy_input,
            onnx_path,
            input_names=["observation"],
            output_names=["action", "logits"],
            dynamic_axes={"observation": {0: "batch_size"}, "action": {0: "batch_size"}, "logits": {0: "batch_size"}},
            opset_version=17,
        )

    print("ONNX export completed successfully!\n")

    print("-------------------------------------------------------------")
    print("Verifying ONNX Output vs Original PyTorch Model...")
    print("-------------------------------------------------------------")

    test_vectors = [
        ("Automated Scanner Vector", np.zeros(25, dtype=np.float32)),
        ("Brute Force Attack Vector", np.zeros(25, dtype=np.float32)),
        ("Interactive Recon Vector", np.zeros(25, dtype=np.float32)),
        ("Payload Download Vector", np.zeros(25, dtype=np.float32)),
    ]

    test_vectors[0][1][23] = 1.0  # is_scanner
    test_vectors[0][1][18] = 1.0  # touches_web_portal
    
    test_vectors[1][1][5] = 0.5   # high login attempts
    test_vectors[1][1][17] = 1.0  # touches_cowrie
    
    test_vectors[2][1][12] = 0.4  # recon commands
    test_vectors[2][1][8] = 1.0   # login success
    test_vectors[2][1][17] = 1.0

    test_vectors[3][1][13] = 0.8  # download attempts
    test_vectors[3][1][20] = 0.5  # mitre techniques seen

    ort_session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    action_names = ["maintain", "escalate_tier", "plant_breadcrumb", "observe_only"]

    all_matched = True
    for label, vec in test_vectors:
        orig_action, _ = model.predict(vec, deterministic=True)
        orig_action = int(orig_action)

        input_tensor = np.expand_dims(vec, axis=0).astype(np.float32)
        onnx_outputs = ort_session.run(["action", "logits"], {"observation": input_tensor})
        onnx_action = int(onnx_outputs[0][0])
        onnx_logits = onnx_outputs[1][0]

        matched = (orig_action == onnx_action)
        status = "MATCH [OK]" if matched else "MISMATCH [FAIL]"
        if not matched:
            all_matched = False

        print(f"Test: {label}")
        print(f"  PyTorch Output:  Action {orig_action} ({action_names[orig_action]})")
        print(f"  ONNX Output:     Action {onnx_action} ({action_names[onnx_action]})")
        print(f"  Action Logits:   {np.round(onnx_logits, 2)}")
        print(f"  Verification:    {status}\n")

    print("=============================================================")
    if all_matched:
        print("VERIFICATION SUCCESS: ONNX model matches PyTorch 100%!")
        print("The ONNX model is ready for Step 5 (RL Sidecar Microservice).")
    else:
        print("VERIFICATION FAILED: Discrepancy detected.")
    print("=============================================================\n")


if __name__ == "__main__":
    export_and_verify()
