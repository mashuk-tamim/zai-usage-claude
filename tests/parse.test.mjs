import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuota, resolveApiKey, CONFIG_TEMPLATE } from '../plugins/zai-usage-tracker/skills/zai-usage/scripts/zai-usage.mjs';

const resp = (limits, data = {}) => ({ success: true, data: { limits, ...data } });

test('unit 3 × number 5 (300 min) → session window', () => {
  const p = parseQuota(resp([{ type: 'TOKENS_LIMIT', unit: 3, number: 5, percentage: 30, currentValue: 1200, usage: 4000, nextResetTime: 1000 }]));
  assert.equal(p.session.currentValue, 1200);
  assert.equal(p.weekly, null);
});

test('unit 6 (10080 min) → weekly window', () => {
  const p = parseQuota(resp([{ type: 'CREDIT_LIMIT', unit: 6, number: 1, percentage: 15, currentValue: 340, usage: 2200 }]));
  assert.equal(p.weekly.type, 'CREDIT_LIMIT');
  assert.equal(p.session, null);
});

test('TIME_LIMIT → MCP calls', () => {
  const p = parseQuota(resp([{ type: 'TIME_LIMIT', unit: 5, number: 1, percentage: 4, currentValue: 3, usage: 100 }]));
  assert.equal(p.mcp.currentValue, 3);
  assert.equal(p.session, null);
});

test('opaque unit/number falls back to session then weekly', () => {
  const p = parseQuota(resp([
    { type: 'TOKENS_LIMIT', unit: 9, number: 9, percentage: 1 },
    { type: 'TOKENS_LIMIT', unit: 8, number: 8, percentage: 2 }
  ]));
  assert.equal(p.session.percentage, 1);
  assert.equal(p.weekly.percentage, 2);
});

test('plan tier from level when planName missing', () => {
  const p = parseQuota(resp([], { level: 'pro' }));
  assert.equal(p.plan, 'GLM Pro Plan');
});

test('plan tier from planName wins', () => {
  const p = parseQuota(resp([], { planName: 'GLM Coding Plan', level: 'pro' }));
  assert.equal(p.plan, 'GLM Coding Plan');
});

test('throws on invalid structure', () => {
  assert.throws(() => parseQuota({ success: false }));
  assert.throws(() => parseQuota(null));
});

test('resolveApiKey prioritizes explicit ZAI_API_KEY in env', () => {
  const auth = resolveApiKey({
    env: { ZAI_API_KEY: 'env-zai-key' },
    readFile: () => JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: 'token-in-settings' } })
  });
  assert.equal(auth.key, 'env-zai-key');
});

test('resolveApiKey extracts ANTHROPIC_AUTH_TOKEN from ~/.claude/settings.json', () => {
  const auth = resolveApiKey({
    env: {},
    homedir: () => '/mock/home',
    readFile: (p) => {
      if (p === '/mock/home/.claude/settings.json') {
        return JSON.stringify({
          env: {
            ANTHROPIC_AUTH_TOKEN: 'mock-zai-token',
            ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic'
          }
        });
      }
      return null;
    }
  });
  assert.equal(auth.key, 'mock-zai-token');
});

test('resolveApiKey extracts ZAI_API_KEY from ~/.claude/settings.json', () => {
  const auth = resolveApiKey({
    env: {},
    homedir: () => '/mock/home',
    readFile: (p) => {
      if (p === '/mock/home/.claude/settings.json') {
        return JSON.stringify({
          env: { ZAI_API_KEY: 'mock-zai-settings-key' }
        });
      }
      return null;
    }
  });
  assert.equal(auth.key, 'mock-zai-settings-key');
});

test('resolveApiKey returns null when no key is present', () => {
  const auth = resolveApiKey({
    env: {},
    homedir: () => '/mock/home',
    readFile: () => null
  });
  assert.equal(auth, null);
});

test('CONFIG_TEMPLATE contains required Z.ai environment fields', () => {
  assert.ok(CONFIG_TEMPLATE.env.ANTHROPIC_AUTH_TOKEN);
  assert.equal(CONFIG_TEMPLATE.env.ANTHROPIC_BASE_URL, 'https://api.z.ai/api/anthropic');
  assert.ok(CONFIG_TEMPLATE.env.ANTHROPIC_DEFAULT_OPUS_MODEL);
});
