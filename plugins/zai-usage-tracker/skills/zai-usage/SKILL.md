---
name: zai-usage
description: Show Z.ai (GLM) Coding Plan quota usage — 5-hour, weekly, and MCP limits with reset times. Use when the user asks about Z.ai or GLM usage, quota, limits, or remaining credits, or invokes /zai-usage.
argument-hint: "[--tz <IANA-timezone>] [--24h] [--json] [--config]"
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/zai-usage.mjs *)
---

Run the bundled reporter and show its output to the user as-is (it is already formatted):

```bash
node ${CLAUDE_SKILL_DIR}/scripts/zai-usage.mjs $ARGUMENTS
```

- Exit code 1 with key not found → tell the user to configure settings (`code ~/.claude/settings.json`) or export `ZAI_API_KEY=...`, then re-run.
- Exit code 2 → API/HTTP error: show the stderr message, suggest re-running later.
- `--json` → output is raw parsed JSON; summarize it in a small table instead of dumping it.
- `--config` → displays recommended `~/.claude/settings.json` configuration template for using Z.ai in Claude Code.
- If the user wants different formatting, offer `--tz <IANA-timezone>` (default: system local) and `--24h`.
