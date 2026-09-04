#!/usr/bin/env node
// Z.ai (GLM) Coding Plan quota reporter — zero deps, Node 18+.
// Used by the /zai-usage Claude Code skill. API key comes from ZAI_API_KEY.
const ENDPOINT = 'https://api.z.ai/api/monitor/usage/quota/limit';

// Mirrors parseQuotaResponse in the VS Code extension: opaque unit/number
// fields are disambiguated via a minutes-multiplier map.
export function parseQuota(response) {
  if (!response || response.success === false || !response.data || !Array.isArray(response.data.limits)) {
    throw new Error('Invalid quota response structure');
  }

  const multipliers = { 1: 1440, 3: 60, 5: 1, 6: 10080 };
  let session = null;
  let weekly = null;
  let mcp = null;

  for (const raw of response.data.limits) {
    if (!raw) continue;
    const minutes = raw.number > 0 && multipliers[raw.unit] ? raw.number * multipliers[raw.unit] : null;
    const item = {
      type: raw.type,
      percentage: raw.percentage || 0,
      currentValue: raw.currentValue || 0,
      usage: raw.usage || 0,
      minutes,
      nextResetTime: raw.nextResetTime ? Number(raw.nextResetTime) : null
    };

    if (raw.type === 'TIME_LIMIT') {
      mcp = item;
    } else if (minutes === 300 || (raw.unit === 3 && raw.number === 5)) {
      session = item;
    } else if (minutes === 10080 || raw.unit === 6) {
      weekly = item;
    } else if (!session) {
      session = item;
    } else if (!weekly) {
      weekly = item;
    }
  }

  let plan = response.data.planName || response.data.plan;
  if (!plan && response.data.level) {
    plan = `GLM ${response.data.level.charAt(0).toUpperCase()}${response.data.level.slice(1)} Plan`;
  }
  if (!plan) plan = 'GLM Lite Plan';

  return { plan, session, weekly, mcp };
}

function fmtNum(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return String(n);
}

function bar(pct, width = 20) {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function fmtReset(epochMs, tz, h24) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz === 'local' ? undefined : tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: h24 ? '2-digit' : 'numeric',
      minute: '2-digit',
      hour12: !h24
    }).format(new Date(epochMs));
  } catch {
    return new Date(epochMs).toLocaleString();
  }
}

async function fetchQuota(key) {
  const headers = { Authorization: key, Accept: 'application/json' };
  let res = await fetch(ENDPOINT, { headers, signal: AbortSignal.timeout(10000) });
  if (res.status === 401 && !key.startsWith('Bearer ')) {
    // Same fallback as the extension: some keys need a Bearer prefix.
    res = await fetch(ENDPOINT, { headers: { ...headers, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${ENDPOINT} — check your ZAI_API_KEY`);
  return res.json();
}

function usage() {
  console.error('Usage: node zai-usage.mjs [--tz <IANA-timezone>] [--24h] [--json]');
}

async function main() {
  let tz = 'local';
  let h24 = false;
  let json = false;

  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--tz') {
      tz = process.argv[++i];
      if (!tz) { usage(); process.exit(1); }
    } else if (a === '--24h') {
      h24 = true;
    } else if (a === '--json') {
      json = true;
    } else if (a === '--help' || a === '-h') {
      usage();
      process.exit(0);
    } else {
      console.error(`Unknown option: ${a}`);
      usage();
      process.exit(1);
    }
  }

  const key = process.env.ZAI_API_KEY;
  if (!key) {
    console.error(
      'ZAI_API_KEY is not set.\n' +
      'Get a key: https://z.ai/manage-apikey/apikey-list\n' +
      'Set it either:\n' +
      '  export ZAI_API_KEY=your-key\n' +
      '  or in ~/.claude/settings.json:  { "env": { "ZAI_API_KEY": "your-key" } }'
    );
    process.exit(1);
  }

  let parsed;
  try {
    parsed = parseQuota(await fetchQuota(key));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }

  if (json) {
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

  const tzName = tz === 'local'
    ? (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'local'; } })()
    : tz;

  console.log(`${parsed.plan} — Z.ai Usage  (times in ${tzName})\n`);

  const rows = [];
  if (parsed.session) rows.push(['5-Hour', parsed.session]);
  if (parsed.weekly) rows.push(['Weekly', parsed.weekly]);
  if (parsed.mcp) rows.push(['MCP', parsed.mcp]);

  if (rows.length === 0) {
    console.log('No active limits reported.');
    return;
  }

  for (const [label, l] of rows) {
    const unit = l.type === 'CREDIT_LIMIT' ? 'credits' : (label === 'MCP' ? 'calls' : 'tokens');
    console.log(`${label.padEnd(8)}${String(Math.round(l.percentage)).padStart(3)}%  ${bar(l.percentage)}  ${fmtNum(l.currentValue)} / ${fmtNum(l.usage)} ${unit}`);
    if (l.nextResetTime) {
      console.log(`${''.padEnd(8)}Resets ${fmtReset(l.nextResetTime, tz, h24)}`);
    }
  }
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
