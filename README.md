# Z.ai Usage Tracker for Claude Code

A `/zai-usage` slash command for [Claude Code](https://code.claude.com) that shows your Z.ai (GLM) Coding Plan quota: 5-hour window, weekly window, and MCP tool calls — with usage bars and reset times. Companion to the [Z.ai Usage Tracker VS Code extension](https://github.com/mashuk-tamim/zai-usage-tracker-vscode).

```
GLM Coding Plan — Z.ai Usage  (times in Asia/Dhaka)

5-Hour     30%  ██████░░░░░░░░░░░░░░  1.2M / 4.0M tokens
           Resets Friday, September 5, 2026 at 1:14 AM
Weekly     15%  ███░░░░░░░░░░░░░░░░░  340.50K / 2.2M tokens
           Resets Monday, September 8, 2026 at 6:00 PM
MCP         4%  █░░░░░░░░░░░░░░░░░░░  3 / 100 calls

To configure settings: code ~/.claude/settings.json [active: env.ANTHROPIC_AUTH_TOKEN]
```

## Setup

**Zero-config if you use Z.ai with Claude Code:**
If your `~/.claude/settings.json` already configures Z.ai as your Anthropic provider (`ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL`), the command **automatically detects and reads your token** from `~/.claude/settings.json` or the environment. No extra setup is required!

### Recommended `~/.claude/settings.json` for Z.ai

Run `code ~/.claude/settings.json` in your terminal and add:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-zai-api-key",
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "1",
    "DISABLE_TELEMETRY": "1",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-5.3-flash[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5.3-flash[1m]",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-5.3[1m]",
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "700000"
  }
}
```

Or if you only want to track quota without routing Claude Code traffic through Z.ai, simply set `"ZAI_API_KEY": "your-key"` in `~/.claude/settings.json`, or export `ZAI_API_KEY=your-key` in your shell profile.

## Install

### Option A — bare `/zai-usage` (personal skill)

```bash
git clone https://github.com/mashuk-tamim/zai-usage-claude
mkdir -p ~/.claude/skills
cp -r zai-usage-claude/plugins/zai-usage-tracker/skills/zai-usage ~/.claude/skills/
```

Then run `/zai-usage` in any Claude Code session. Updating = re-running the `cp`.

### Option B — plugin (auto-updatable via marketplace)

In Claude Code:

```
/plugin marketplace add mashuk-tamim/zai-usage-claude
/plugin install zai-usage-tracker@zai-usage-claude
```

Then run `/zai-usage-tracker:zai-usage`. (Plugin commands are always namespaced — that's a Claude Code platform rule. Use Option A if you want the bare name.) Update later with `/plugin marketplace update zai-usage-claude`.

## Usage

```
/zai-usage                 # system-local timezone, 12h clock
/zai-usage --24h           # 24-hour clock
/zai-usage --tz Asia/Dhaka # override timezone
/zai-usage --config        # show settings.json configuration template
/zai-usage --json          # raw parsed JSON
```

Or just ask Claude things like "how much Z.ai quota do I have left?" — the skill auto-triggers.

## How it works

- `GET https://api.z.ai/api/monitor/usage/quota/limit` with the key in the `Authorization` header (falls back to `Bearer` on 401 — same as the VS Code extension).
- The API's opaque `unit`/`number` window fields are decoded via a minutes-multiplier map (`unit 3 × 5` = 300 min session, `unit 6` = 10080 min weekly), matching `parseQuotaResponse` in the extension. If the API shape changes, fix `parseQuota` in `plugins/zai-usage-tracker/skills/zai-usage/scripts/zai-usage.mjs`.
- No dependencies; requires Node 18+.

## Development

```bash
node --test tests/parse.test.mjs   # parser tests
claude plugin validate .  # validate marketplace
claude plugin validate plugins/zai-usage-tracker
```

During development you can load the plugin unpacked: `claude --plugin-dir ./plugins/zai-usage-tracker`, then `/reload-plugins`.

## License

MIT
