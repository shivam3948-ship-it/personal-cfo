#!/usr/bin/env python3
"""Repo hygiene checks, run in CI and by the Claude Code PostToolUse hook.

Usage:
  python scripts/check_repo.py            # check all tracked files (CI)
  python scripts/check_repo.py FILE ...   # check specific files (hook)
Exit 1 on any violation.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAN = re.compile(r"\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b")  # Indian PAN shape
SECRET = re.compile(r"(sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]+\.)")
FORBIDDEN_SUFFIXES = {".pdf"}
FORBIDDEN_NAMES = {".env"}
ALLOWLIST_PAN = {"ABCPE1234F"}  # documented dummy PAN for fixtures
LINK = re.compile(r"\]\(([^)#\s]+)(?:#[^)]*)?\)")


def tracked_files() -> list[Path]:
    out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return [ROOT / f for f in out.splitlines()]


def check(path: Path) -> list[str]:
    errs: list[str] = []
    rel = path.relative_to(ROOT) if path.is_absolute() and ROOT in path.parents else path
    if path.suffix.lower() in FORBIDDEN_SUFFIXES or path.name in FORBIDDEN_NAMES:
        errs.append(f"{rel}: statements/secrets must never be committed")
        return errs
    if not path.is_file():
        return errs
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return errs
    for m in PAN.finditer(text):
        if m.group(0) not in ALLOWLIST_PAN:
            errs.append(f"{rel}: PAN-like value '{m.group(0)[:3]}…' found; use the dummy ABCPE1234F")
    if SECRET.search(text):
        errs.append(f"{rel}: secret-like token found")
    if path.suffix == ".md":
        for target in LINK.findall(text):
            if target.startswith(("http://", "https://", "mailto:")):
                continue
            if not (path.parent / target).exists():
                errs.append(f"{rel}: broken relative link -> {target}")
    return errs


def main(argv: list[str]) -> int:
    files = [Path(a).resolve() for a in argv] if argv else tracked_files()
    errs = [e for f in files for e in check(f)]
    for e in errs:
        print(e, file=sys.stderr)
    print(f"check_repo: {len(files)} file(s), {len(errs)} problem(s)")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
