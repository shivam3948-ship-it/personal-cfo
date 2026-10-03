#!/usr/bin/env python3
"""PostToolUse(Edit|Write): run repo hygiene checks on the edited file; exit 2 shows problems to Claude."""
import json, subprocess, sys, os
data = json.load(sys.stdin)
path = data.get("tool_input", {}).get("file_path")
if not path:
    sys.exit(0)
root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
r = subprocess.run([sys.executable, f"{root}/scripts/check_repo.py", path], capture_output=True, text=True)
if r.returncode:
    sys.stderr.write(r.stderr)
    sys.exit(2)
