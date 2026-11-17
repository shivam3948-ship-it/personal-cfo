@AGENTS.md

## Claude Code specifics
- `AGENTS.md` is the single source of truth for every coding agent; put shared rules there, not here.
- Path-scoped rules: `.claude/rules/` (compliance always loads; code-style and testing load for matching files).
- Hooks and permissions: `.claude/settings.json`. Hooks block reading statements/secrets and scan edited files for PII-like patterns.
- Subagent: use `compliance-reviewer` before merging any change to prompts, insight copy or chat behaviour.
- Skill: `add-insight-rule` for the full checklist when adding an insight.
- No `.mcp.json` by design: no MCP server gets access to user data (see DECISIONS D-012).
