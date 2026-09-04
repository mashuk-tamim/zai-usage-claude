---
name: zai-usage
description: Show Z.ai (GLM) Coding Plan quota usage — 5-hour, weekly, and MCP limits with reset times. Use when the user asks about Z.ai or GLM usage, quota, limits, or remaining credits, or invokes /zai-usage.
argument-hint: "[--tz <IANA-timezone>] [--24h] [--json]"
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/zai-usage.mjs *)
---

Run the bundled reporter and show its output to the user as-is (it is already formatted):

```bash
node ${CLAUDE_SKILL_DIR}/scripts/zai-usage.mjs $ARGUMENTS
```

- Exit code 1 with key not found → tell the user to configure the key (never repeat its value): ensure `ANTHROPIC_AUTH_TOKEN` (for Z.ai provider setup) or `ZAI_API_KEY` is in `~/.claude/settings.json`, or export `ZAI_API_KEY=...` in their shell, then re-run.
- Exit code 2 → API/HTTP error: show the stderr message, suggest re-running later.
- `--json` → output is raw parsed JSON; summarize it in a small table instead of dumping it.
- If the user wants different formatting, offer `--tz <IANA-timezone>` (default: system local) and `--24h`.
