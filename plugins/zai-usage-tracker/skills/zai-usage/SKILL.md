---
name: zai-usage
description: Show Z.ai (GLM) Coding Plan quota usage — 5-hour, weekly, and MCP limits with reset times. Use when the user asks about Z.ai or GLM usage, quota, limits, or remaining credits, or invokes /zai-usage.
argument-hint: "[--tz <zone>] [--24h] [--12h] [--set-tz <zone>] [--set-format <12h|24h>] [--json]"
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/zai-usage.mjs *)
---

Run the bundled reporter and show its output to the user as-is (it is already formatted):

```bash
node ${CLAUDE_SKILL_DIR}/scripts/zai-usage.mjs $ARGUMENTS
```

- First-time setup: If the output contains "Notice: Default timezone and format are not set yet", ask the user in your response:
  > *"Would you like to save your default timezone (e.g. `Asia/Dhaka`, `UTC`, `America/New_York`) and time format (`12h` or `24h`) for your quota resets?"*
  When the user replies with their preferences, execute:
  `node ${CLAUDE_SKILL_DIR}/scripts/zai-usage.mjs --set-tz <zone> --set-format <12h|24h>`
- Exit code 1 with key not found → tell the user to ensure ANTHROPIC_AUTH_TOKEN or ZAI_API_KEY is in `~/.claude/settings.json` or exported in their shell, then re-run.
- Exit code 2 → API/HTTP error: show the stderr message, suggest re-running later.
- `--json` → output is raw parsed JSON; summarize it in a small table instead of dumping it.
- If the user wants to update their defaults later, use `--set-tz <zone>` or `--set-format <12h|24h>`. Temporary runs can use `--tz <zone>` and `--24h` / `--12h`.
