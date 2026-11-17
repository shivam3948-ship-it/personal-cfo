---
paths:
  - "services/**/*.py"
  - "jobs/**/*.py"
  - "apps/**/*.{ts,tsx}"
---

# Code style
- Python 3.12, ruff (lint + format), full type hints, pydantic models at API boundaries.
- TypeScript strict; no `any`.
- Money in paise (int/bigint); never floats for currency. Rates as Decimal.
- Prompts live in services/api/ai/prompts/ and are loaded via registry.py; no inline prompt strings.
- Conventional Commits: feat(engine): …, fix(cas): …, docs: …
