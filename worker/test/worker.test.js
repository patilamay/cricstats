import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { safeSql } from '../src/index.js';
import { systemPrompt, EXAMPLES } from '../src/prompt.js';

const ORIGIN = 'https://patilamay.github.io';
const env = (extra = {}) => ({ ANTHROPIC_API_KEY: 'test-key', ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`, MODEL: 'claude-haiku-5-5', ...extra });
const req = (path, body, origin = ORIGIN) => new Request(`https://w.example${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body),
});

function mockAnthropic(reply) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    return new Response(JSON.stringify(reply(calls.length)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return calls;
}

test('safeSql allows one SELECT/WITH and blocks everything else', () => {
  assert.equal(safeSql('SELECT 1;'), 'SELECT 1');
  assert.ok(safeSql("WITH a AS (SELECT 1) SELECT * FROM a WHERE x = 'drop table'"));
  assert.equal(safeSql('DROP TABLE batting'), null);
  assert.equal(safeSql('SELECT 1; SELECT 2'), null);
  assert.equal(safeSql("SELECT * FROM read_csv('x')"), null);
  assert.equal(safeSql('SELECT 1 FROM t; PRAGMA x'), null);
  assert.equal(safeSql('COPY batting TO \'x\''), null);
});

test('prompt includes schema, rules and every example', () => {
  const p = systemPrompt();
  for (const e of EXAMPLES) assert.ok(p.includes(e.q));
  assert.match(p, /history_performances/);
  assert.match(p, /NOT i.is_super_over/);
});

test('/sql returns the tool-call SQL; sends key, model and cached system prompt', async () => {
  const calls = mockAnthropic(() => ({ content: [{ type: 'tool_use', name: 'give_sql', input: { sql: 'SELECT 1 AS x', note: 'demo' } }] }));
  const res = await worker.fetch(req('/sql', { question: 'Who scored the most T20I runs in 2024?' }), env());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { sql: 'SELECT 1 AS x', note: 'demo', standalone: 'Who scored the most T20I runs in 2024?', rejected: false });
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(calls[0].headers['x-api-key'], 'test-key');
  assert.equal(calls[0].body.model, 'claude-haiku-5-5');
  assert.equal(calls[0].body.tool_choice.name, 'give_sql');
  assert.equal(calls[0].body.system[0].cache_control.type, 'ephemeral');
});

test('/sql repair round sends the failed query and error', async () => {
  const calls = mockAnthropic(() => ({ content: [{ type: 'tool_use', input: { sql: 'SELECT 2', note: 'fixed' } }] }));
  await worker.fetch(req('/sql', { question: 'q', previousSql: 'SELEC 1', error: 'syntax error' }), env());
  const msgs = calls[0].body.messages;
  assert.equal(msgs.length, 3);
  assert.match(msgs[2].content, /syntax error/);
});

test('unsafe SQL from the model is rejected', async () => {
  mockAnthropic(() => ({ content: [{ type: 'tool_use', input: { sql: 'DROP TABLE x', note: 'x' } }] }));
  const out = await (await worker.fetch(req('/sql', { question: 'q' }), env())).json();
  assert.equal(out.sql, null);
  assert.equal(out.rejected, true);
});

test('/answer returns the answer and tidied follow-up suggestions', async () => {
  const calls = mockAnthropic(() => ({ content: [{ type: 'tool_use', name: 'give_answer', input: {
    answer: 'Muhammad Waseem scored the most, with 882 runs.',
    followups: ['Waseem\'s best innings?', 'q', '  Most T20I runs in 2023  ', 'most t20i runs in 2023', 'And for women?'],
  } }] }));
  const res = await worker.fetch(req('/answer', { question: 'q', sql: 'SELECT 1', columns: ['player', 'runs'], rows: [['Muhammad Waseem', 882]] }), env());
  assert.deepEqual(await res.json(), { answer: 'Muhammad Waseem scored the most, with 882 runs.', followups: ["Waseem's best innings?", 'Most T20I runs in 2023', 'And for women?'] });
  assert.match(calls[0].body.messages[0].content, /Muhammad Waseem \| 882/);
  assert.equal(calls[0].body.tool_choice.name, 'give_answer');
});

test('/answer still works if the model replies in plain text', async () => {
  mockAnthropic(() => ({ content: [{ type: 'text', text: 'Plain answer.' }] }));
  const res = await worker.fetch(req('/answer', { question: 'q', sql: 'SELECT 1', columns: ['x'], rows: [[1]] }), env());
  assert.deepEqual(await res.json(), { answer: 'Plain answer.', followups: [] });
});

test('origin, method, key, length and rate limits are enforced', async () => {
  mockAnthropic(() => ({ content: [] }));
  assert.equal((await worker.fetch(req('/sql', { question: 'q' }, 'https://evil.example'), env())).status, 403);
  assert.equal((await worker.fetch(req('/sql', { question: 'q' }, null), env())).status, 403);
  assert.equal((await worker.fetch(req('/nope', { question: 'q' }), env())).status, 404);
  assert.equal((await worker.fetch(req('/sql', { question: 'q' }), env({ ANTHROPIC_API_KEY: '' }))).status, 503);
  assert.equal((await worker.fetch(req('/sql', { question: 'x'.repeat(301) }), env())).status, 400);
  const limited = env({ LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal((await worker.fetch(req('/sql', { question: 'q' }), limited)).status, 429);
  const pre = await worker.fetch(new Request('https://w.example/sql', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env());
  assert.equal(pre.status, 204);
});

test('upstream failure gives a friendly 502', async () => {
  globalThis.fetch = async () => new Response('overloaded', { status: 529 });
  const res = await worker.fetch(req('/sql', { question: 'q' }), env());
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /could not be answered/);
});

test('/sql sends earlier turns for follow-ups and returns the standalone question', async () => {
  const calls = mockAnthropic(() => ({ content: [{ type: 'tool_use', input: { standalone: 'Most T20I runs in 2023', sql: 'SELECT 2023', note: 'n' } }] }));
  const history = [
    { question: 'Most T20I runs in 2024?', sql: 'SELECT 2024', result: 'player | runs\nMuhammad Waseem | 882' },
    ...Array.from({ length: 6 }, (_, i) => ({ question: `old ${i}`, sql: 'x'.repeat(5000) })),
  ];
  const out = await (await worker.fetch(req('/sql', { question: 'what about 2023?', history }), env())).json();
  assert.equal(out.standalone, 'Most T20I runs in 2023');
  const text = calls[0].body.messages[0].content;
  assert.match(text, /Follow-up question .*what about 2023\?/);
  assert.doesNotMatch(text, /Most T20I runs in 2024/); // only the last 4 turns are kept
  assert.ok(text.length < 4 * 3200);
});
