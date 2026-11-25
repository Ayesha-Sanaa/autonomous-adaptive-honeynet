"""
Patch Cowrie's honeypot.py to invoke actuation_hook.consume_and_apply(self)
before executing commands, scheduling Twisted reactor.callLater when observe_only
returns a non-zero delay.

Usage inside Cowrie container or against an extracted honeypot.py:
  python3 tools/patch_cowrie_honeypot.py /path/to/honeypot.py /path/to/honeypot.patched.py
"""

import sys

TARGET_NEEDLE = "        self.runCommand()"
REPLACEMENT = """        try:
            import actuation_hook
            _gn_delay = actuation_hook.consume_and_apply(self)
        except Exception:
            _gn_delay = 0.0
        if _gn_delay > 0:
            from twisted.internet import reactor
            reactor.callLater(_gn_delay, self.runCommand)
            return
        self.runCommand()"""


def patch_file(src_path: str, dst_path: str):
    with open(src_path, "r", encoding="utf-8") as f:
        text = f.read()

    if "actuation_hook.consume_and_apply" in text:
        print("Already patched.")
        with open(dst_path, "w", encoding="utf-8") as f:
            f.write(text)
        return

    if TARGET_NEEDLE not in text:
        raise RuntimeError(
            f"Expected hook target '{TARGET_NEEDLE}' not found in {src_path}. "
            "VERIFY exact line in pinned Cowrie pod before applying."
        )

    patched = text.replace(TARGET_NEEDLE, REPLACEMENT, 1)
    with open(dst_path, "w", encoding="utf-8") as f:
        f.write(patched)
    print(f"Patched honeypot.py written to {dst_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 patch_cowrie_honeypot.py <src_honeypot.py> <dst_honeypot.py>")
        sys.exit(1)
    patch_file(sys.argv[1], sys.argv[2])
