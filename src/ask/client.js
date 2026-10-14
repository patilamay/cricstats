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

// Full round trip: question -> SQL (Claude) -> run in browser -> one-sentence answer (Claude).
// If the query fails, Claude gets one chance to fix it.
export async function ask(question, onStage = () => {}) {
  onStage('Working out the query');
  let { sql, note } = await post('/sql', { question });
  if (!sql) return { question, cannot: true, note: note || "That question can't be answered from this site's data." };

  onStage('Crunching the numbers');
  let result;
  try {
    result = await runQuery(sql);
  } catch (err) {
    onStage('Adjusting the query');
    const fix = await post('/sql', { question, previousSql: sql, error: err.message });
    if (!fix.sql) return { question, cannot: true, note: fix.note || 'The query could not be fixed.' };
    sql = fix.sql;
    note = fix.note || note;
    result = await runQuery(sql);
  }

  onStage('Writing the answer');
  let answer = null;
  try {
    ({ answer } = await post('/answer', { question, sql, columns: result.columns, rows: result.rows.slice(0, 20) }));
  } catch { /* the table still answers the question */ }
  return { question, sql, note, answer, ...result };
}

// Example questions run their known-good SQL locally; the answer sentence is added when the service is on.
export async function runExample(example, onStage = () => {}) {
  onStage('Crunching the numbers');
  const result = await runQuery(example.sql);
  let answer = null;
  if (askEnabled()) {
    onStage('Writing the answer');
    try {
      ({ answer } = await post('/answer', { question: example.q, sql: example.sql, columns: result.columns, rows: result.rows.slice(0, 20) }));
    } catch { /* keep the table */ }
  }
  return { question: example.q, sql: example.sql, note: null, answer, ...result };
}
