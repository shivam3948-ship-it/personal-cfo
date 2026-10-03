# Testing
- Every engine metric: unit test against a hand-computed or spreadsheet reference.
- Every insight rule: golden-set case + deterministic template fallback test.
- Every new table: RLS test + coverage in the delete_user integration test.
- Log-redaction test must pass (no PAN / password / folio patterns in captured logs).
- AI-touching changes: run evals/ and attach the scorecard diff to the PR.
