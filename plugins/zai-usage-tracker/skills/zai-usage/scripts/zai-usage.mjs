#!/usr/bin/env node
// Z.ai (GLM) Coding Plan quota reporter — zero deps, Node 18+.
// Used by the /zai-usage Claude Code skill. API key comes from ~/.claude/settings.json or env.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

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
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${ENDPOINT} — check your Z.ai API key / token`);
  return res.json();
}

// Resolves Z.ai API key from multiple standard locations:
// 1. process.env.ZAI_API_KEY
// 2. ~/.claude/settings.json (env.ZAI_API_KEY or env.ANTHROPIC_AUTH_TOKEN)
// 3. process.env.ANTHROPIC_AUTH_TOKEN (used by Claude Code when configured with Z.ai)
export function resolveApiKey(options = {}) {
  const env = options.env || process.env;
  const readFile = options.readFile || ((p) => {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch {
      return null;
    }
  });
  const homedir = options.homedir || os.homedir;

  // 1. Explicit ZAI_API_KEY environment variable
  if (env.ZAI_API_KEY) {
    return { key: env.ZAI_API_KEY, source: 'process.env.ZAI_API_KEY' };
  }

  // 2. ~/.claude/settings.json
  const settingsPaths = [
    path.join(homedir(), '.claude', 'settings.json'),
    path.join(process.cwd(), '.claude', 'settings.json')
  ];

  for (const p of settingsPaths) {
    const raw = readFile(p);
    if (!raw) continue;
    try {
      const config = JSON.parse(raw);
      const confEnv = config.env || {};
      if (confEnv.ZAI_API_KEY) {
        return { key: confEnv.ZAI_API_KEY, source: `${p} (env.ZAI_API_KEY)` };
      }
      if (confEnv.ANTHROPIC_AUTH_TOKEN && (!confEnv.ANTHROPIC_BASE_URL || confEnv.ANTHROPIC_BASE_URL.includes('z.ai'))) {
        return { key: confEnv.ANTHROPIC_AUTH_TOKEN, source: `${p} (env.ANTHROPIC_AUTH_TOKEN)` };
      }
      if (confEnv.ANTHROPIC_AUTH_TOKEN) {
        return { key: confEnv.ANTHROPIC_AUTH_TOKEN, source: `${p} (env.ANTHROPIC_AUTH_TOKEN)` };
      }
    } catch {}
  }

  // 3. ANTHROPIC_AUTH_TOKEN in environment (e.g. if set by Claude Code / shell)
  if (env.ANTHROPIC_AUTH_TOKEN && (!env.ANTHROPIC_BASE_URL || env.ANTHROPIC_BASE_URL.includes('z.ai'))) {
    return { key: env.ANTHROPIC_AUTH_TOKEN, source: 'process.env.ANTHROPIC_AUTH_TOKEN' };
  }
  if (env.ANTHROPIC_AUTH_TOKEN) {
    return { key: env.ANTHROPIC_AUTH_TOKEN, source: 'process.env.ANTHROPIC_AUTH_TOKEN' };
  }

  return null;
}

export function getPreferencesPath(homedir = os.homedir) {
  return path.join(homedir(), '.claude', 'zai-usage.json');
}

export function validateTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function loadPreferences(options = {}) {
  const homedir = options.homedir || os.homedir;
  const readFile = options.readFile || ((p) => {
    try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
  });
  const configPath = options.configPath || getPreferencesPath(homedir);

  const raw = readFile(configPath);
  if (!raw) {
    return { timezone: null, timeFormat: null, isConfigured: false };
  }

  try {
    const data = JSON.parse(raw);
    const timezone = typeof data.timezone === 'string' && data.timezone.trim() ? data.timezone.trim() : null;
    const timeFormat = data.timeFormat === '24h' || data.timeFormat === '12h' ? data.timeFormat : null;
    return {
      timezone,
      timeFormat,
      isConfigured: !!(timezone || timeFormat)
    };
  } catch {
    return { timezone: null, timeFormat: null, isConfigured: false };
  }
}

export function savePreferences(newPrefs, options = {}) {
  const homedir = options.homedir || os.homedir;
  const configPath = options.configPath || getPreferencesPath(homedir);
  const writeFile = options.writeFile || ((p, content) => {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, content, 'utf8');
  });

  const existing = loadPreferences({ homedir, configPath, readFile: options.readFile });
  const merged = {
    timezone: newPrefs.timezone !== undefined ? newPrefs.timezone : existing.timezone,
    timeFormat: newPrefs.timeFormat !== undefined ? newPrefs.timeFormat : existing.timeFormat
  };

  writeFile(configPath, JSON.stringify(merged, null, 2) + '\n');
  return merged;
}

function usage() {
  console.error('Usage: /zai-usage [--tz <IANA-timezone>] [--24h] [--12h] [--set-tz <zone>] [--set-format <12h|24h>] [--json]');
}

async function main() {
  let tz = null;
  let h24 = null;
  let json = false;
  let setTz = null;
  let setFormat = null;

  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--tz') {
      tz = process.argv[++i];
      if (!tz) { usage(); process.exit(1); }
    } else if (a === '--24h') {
      h24 = true;
    } else if (a === '--12h') {
      h24 = false;
    } else if (a === '--set-tz') {
      setTz = process.argv[++i];
      if (!setTz) { usage(); process.exit(1); }
    } else if (a === '--set-format') {
      setFormat = process.argv[++i];
      if (!setFormat) { usage(); process.exit(1); }
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

  const savedMessages = [];
  if (setTz !== null) {
    if (!validateTimezone(setTz)) {
      console.error(`Invalid IANA timezone: "${setTz}". Example valid timezones: Asia/Dhaka, America/New_York, Europe/London, UTC.`);
      process.exit(1);
    }
    savePreferences({ timezone: setTz });
    savedMessages.push(`Default timezone saved as ${setTz}`);
  }
  if (setFormat !== null) {
    const fmt = setFormat.toLowerCase();
    if (fmt !== '12h' && fmt !== '24h') {
      console.error(`Invalid time format: "${setFormat}". Must be "12h" or "24h".`);
      process.exit(1);
    }
    savePreferences({ timeFormat: fmt });
    savedMessages.push(`Default time format saved as ${fmt}`);
  }

  const prefs = loadPreferences();
  const activeTz = tz || prefs.timezone || 'local';
  const active24h = h24 !== null ? h24 : (prefs.timeFormat === '24h');

  const auth = resolveApiKey();
  if (!auth?.key) {
    console.error(
      'Z.ai API key is not set.\n' +
      'Please ensure ANTHROPIC_AUTH_TOKEN or ZAI_API_KEY is in ~/.claude/settings.json or export ZAI_API_KEY=your-key.'
    );
    process.exit(1);
  }

  const key = auth.key;

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

  if (savedMessages.length > 0) {
    console.log(`✓ ${savedMessages.join(' & ')}\n`);
  }

  const tzName = activeTz === 'local'
    ? (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'local'; } })()
    : activeTz;

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
      console.log(`${''.padEnd(8)}Resets ${fmtReset(l.nextResetTime, activeTz, active24h)}`);
    }
  }

  if (!prefs.isConfigured) {
    console.log('\nNotice: Default timezone and format are not set yet.');
  }

  console.log('\nOptions:');
  console.log('  /zai-usage --tz <zone>           Set timezone for this run');
  console.log('  /zai-usage --24h                 24-hour time format');
  console.log('  /zai-usage --set-tz <zone>       Save default timezone (e.g. Asia/Dhaka)');
  console.log('  /zai-usage --set-format <12|24>  Save default format (12h or 24h)');
  console.log('  /zai-usage --json                Output raw parsed JSON');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
