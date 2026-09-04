import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuota } from '../plugins/zai-usage-tracker/skills/zai-usage/scripts/zai-usage.mjs';

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
