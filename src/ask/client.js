import { ASK_URL } from '../config.js';
import { runQuery } from './engine.js';

async function post(path, body) {
  const res = await fetch(`${ASK_URL.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new Error((data && data.error) || `The Ask service returned ${res.status}.`);
  return data;
}

export const askEnabled = () => !!ASK_URL;

// A few result rows as text, so a follow-up like "how many hundreds did he score?" knows who "he" is.
function resultText(item) {
  if (!item.columns || !item.rows) return '';
  return [item.columns.join(' | '), ...item.rows.slice(0, 3).map((r) => r.map((v) => (v == null ? '' : String(v))).join(' | '))].join('\n');
}

// The last few answered turns, oldest first, as context for the next question.
export function historyFrom(thread) {
  return thread.filter((t) => t.sql).slice(-4).map((t) => ({ question: t.standalone || t.question, sql: t.sql, result: resultText(t) }));
}

// Full round trip: question (+ earlier turns) -> SQL (Claude) -> run in browser -> short answer (Claude).
// If the query fails, Claude gets one chance to fix it.
export async function ask(question, history = [], onStage = () => {}) {
  onStage(history.length ? 'Following on from the conversation' : 'Working out the query');
  let { sql, note, standalone } = await post('/sql', { question, history });
  standalone = standalone || question;
  if (!sql) return { question, standalone, cannot: true, note: note || "That question can't be answered from this site's data." };

  onStage('Crunching the numbers');
  let result;
  try {
    result = await runQuery(sql);
  } catch (err) {
    onStage('Adjusting the query');
    const fix = await post('/sql', { question, history, previousSql: sql, error: err.message });
    if (!fix.sql) return { question, standalone, cannot: true, note: fix.note || 'The query could not be fixed.' };
    sql = fix.sql;
    note = fix.note || note;
    result = await runQuery(sql);
  }

  onStage('Writing the answer');
  let answer = null;
  let followups = [];
  try {
    ({ answer, followups = [] } = await post('/answer', { question: standalone, sql, columns: result.columns, rows: result.rows.slice(0, 20) }));
  } catch { /* the table still answers the question */ }
  return { question, standalone, sql, note, answer, followups, ...result };
}

// Example questions run their known-good SQL locally; the answer sentence is added when the service is on.
export async function runExample(example, onStage = () => {}) {
  onStage('Crunching the numbers');
  const result = await runQuery(example.sql);
  let answer = null;
  let followups = [];
  if (askEnabled()) {
    onStage('Writing the answer');
    try {
      ({ answer, followups = [] } = await post('/answer', { question: example.q, sql: example.sql, columns: result.columns, rows: result.rows.slice(0, 20) }));
    } catch { /* keep the table */ }
  }
  return { question: example.q, standalone: example.q, sql: example.sql, note: null, answer, followups, ...result };
}
