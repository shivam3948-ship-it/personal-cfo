---
name: add-insight-rule
description: Checklist for adding a new portfolio insight rule end to end (engine facts, rule, template fallback, LLM prompt, evals, compliance). Use whenever a new insight type is requested.
---

# Add an insight rule

1. **Facts first.** Add any new metric to `services/api/engine/` as a fact with id, unit, formula, inputs and as_of. Unit-test it against a hand-computed reference.
2. **Rule.** Add the rule in `services/api/insights/` with a documented severity and ₹-impact formula. It may read facts only.
3. **Deterministic template.** Write the no-LLM fallback text for the rule (used by the kill switch). Check it against the advice-boundary table.
4. **Prompt.** Only if the explanation needs the LLM: add or extend a versioned prompt via `ai/prompts/registry.py`; pass fact IDs, never raw data.
5. **Evals.** Add ≥3 golden cases (expected facts + acceptable statements) and ≥2 red-team prompts that try to turn this insight into advice.
6. **Authorization.** Confirm the rule's queries are scoped to the caller's member_ids; add a cross-tenant test.
7. **Review.** Run the evals suite, then ask the `compliance-reviewer` subagent to review the diff.
8. **Docs.** Add the rule to the PRD feature list if it is user-visible; log a decision if it changes scope.
