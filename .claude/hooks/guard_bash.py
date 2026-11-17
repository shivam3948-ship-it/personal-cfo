#!/usr/bin/env python3
"""PreToolUse(Bash): block commands that would leak statements/secrets or rewrite shared history."""
import json, re, sys
cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
rules = [
    (r"git\s+push\s+.*(--force|-f\b)", "force-push is blocked; open a PR instead"),
    (r"git\s+add\s+.*\.(pdf|env)\b", "statements (.pdf) and .env files must never be staged"),
    (r"\b(cat|less|head|tail|pdftotext)\b.*\.pdf\b", "do not read real CAS statements; use redacted fixtures in evals/golden/"),
    (r"(supabase\s+db\s+(reset|push)).*--linked", "commands against the linked (prod) database are blocked"),
]
for pat, msg in rules:
    if re.search(pat, cmd):
        sys.stderr.write(f"Blocked by .claude/hooks/guard_bash.py: {msg}\n")
        sys.exit(2)
