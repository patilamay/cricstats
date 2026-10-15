// CricStats "Ask" worker.
//
//   POST /sql     { question, history?, previousSql?, error? } -> { sql, note, standalone }
//                 history: up to 4 earlier turns [{ question, sql, result }] so follow-ups work
//   POST /answer  { question, sql, columns, rows }           -> { answer }
//
// Holds the Anthropic API key (secret ANTHROPIC_API_KEY), limits requests per visitor, and only
// accepts requests from the site's origins. The SQL it returns runs in the visitor's browser
// (DuckDB-WASM over the site's Parquet files), so the worker never touches the data.

import { systemPrompt } from './prompt.js';

const API = 'https://api.anthropic.com/v1/messages';
const MAX_QUESTION = 300;

export function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export { safeSql } from './safe.js';
import { safeSql } from './safe.js';

async function claude(env, body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: env.MODEL || 'claude-haiku-5-5', ...body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

const SQL_TOOL = {
  name: 'give_sql',
  description: 'Return the DuckDB query that answers the question, or null if it cannot be answered from the tables.',
  input_schema: {
    type: 'object',
    properties: {
      sql: { type: ['string', 'null'], description: 'One read-only DuckDB SELECT query, or null.' },
      standalone: { type: 'string', description: 'The question rewritten to stand on its own, with any reference to earlier questions resolved, e.g. "what about 2023?" after a 2024 T20I runs question becomes "Most men\'s T20I runs in 2023". Same language as the user.' },
      note: { type: 'string', description: 'One short plain-English sentence for a cricket fan (not a programmer): what was counted and any assumption made, e.g. "Men\'s T20Is in 2024, all teams." or "Full international careers, including matches before 2002." Never mention tables, columns, joins, SQL, IDs or super overs. If it cannot be answered, say why in the same plain style.' },
    },
    required: ['standalone', 'sql', 'note'],
  },
};

// Earlier turns of the conversation, trimmed to keep each request small.
const MAX_TURNS = 4;
export function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-MAX_TURNS).map((h) => ({
    question: String((h && h.question) || '').slice(0, 300),
    sql: String((h && h.sql) || '').slice(0, 2000),
    result: String((h && h.result) || '').slice(0, 600),
  })).filter((h) => h.question);
}

function withHistory(question, history) {
  if (!history.length) return `Question: ${question}`;
  const turns = history.map((h, i) => `Q${i + 1}: ${h.question}\nSQL:\n${h.sql || '(none)'}\nResult (first rows):\n${h.result || '(not shown)'}`).join('\n\n');
  return `Conversation so far (oldest first):\n\n${turns}\n\nFollow-up question (it may refer to the conversation above): ${question}`;
}

export async function writeSql(env, { question, previousSql, error, history = [] }) {
  const messages = [{ role: 'user', content: withHistory(question, history) }];
  if (previousSql && error) {
    messages.push({ role: 'assistant', content: `SQL:\n${previousSql}` });
    messages.push({ role: 'user', content: `That query failed in DuckDB with: ${String(error).slice(0, 500)}\nReturn a corrected query.` });
  }
  const out = await claude(env, {
    max_tokens: 1200,
    system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
    tools: [SQL_TOOL],
    tool_choice: { type: 'tool', name: 'give_sql' },
    messages,
  });
  const call = (out.content || []).find((c) => c.type === 'tool_use');
  if (!call) throw new Error('No query returned');
  const sql = call.input.sql ? safeSql(call.input.sql) : null;
  const standalone = String(call.input.standalone || question).slice(0, 300);
  return { sql, note: call.input.note || '', standalone, rejected: !!call.input.sql && !sql };
}

export async function writeAnswer(env, { question, sql, columns, rows }) {
  const table = [columns.join(' | '), ...rows.slice(0, 20).map((r) => r.map((v) => (v == null ? '' : String(v))).join(' | '))].join('\n');
  const out = await claude(env, {
    max_tokens: 300,
    system: 'You answer cricket statistics questions in one or two plain sentences, using only the query result given. Lead with the direct answer and its key number. If the result is empty, say no matching records were found. Do not mention SQL or tables. Do not add facts that are not in the result.',
    messages: [{ role: 'user', content: `Question: ${question}\n\nQuery:\n${sql}\n\nResult (first rows):\n${table || '(no rows)'}` }],
  });
  const text = (out.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
  return { answer: text };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method !== 'POST' || !['/sql', '/answer'].includes(url.pathname)) return json({ error: 'Not found' }, 404, cors);

    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
    if (!origin || !allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403, cors);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'The Ask service is not configured yet.' }, 503, cors);

    if (env.LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return json({ error: 'Too many questions in a short time. Wait a minute and try again.' }, 429, cors);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, cors); }
    const question = String(body.question || '').trim();
    if (!question) return json({ error: 'Ask a question.' }, 400, cors);
    if (question.length > MAX_QUESTION) return json({ error: `Keep questions under ${MAX_QUESTION} characters.` }, 400, cors);

    try {
      if (url.pathname === '/sql') {
        const out = await writeSql(env, { question, previousSql: body.previousSql, error: body.error, history: cleanHistory(body.history) });
        return json(out, 200, cors);
      }
      const columns = Array.isArray(body.columns) ? body.columns.slice(0, 20).map(String) : [];
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 20).map((r) => (Array.isArray(r) ? r.slice(0, 20) : [])) : [];
      const sql = safeSql(body.sql) || '';
      return json(await writeAnswer(env, { question, sql, columns, rows }), 200, cors);
    } catch (err) {
      return json({ error: 'The question could not be answered right now. Try again shortly.', detail: String(err.message || err).slice(0, 200) }, 502, cors);
    }
  },
};
