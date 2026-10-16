// Saved conversations for signed-in users (Supabase, protected by row-level security).
import { getClient } from '../auth.jsx';

const ROWS_SAVED = 50;

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

const titleOf = (item) => {
  const t = (item.standalone || item.question || 'Conversation').trim();
  return t.length > 80 ? `${t.slice(0, 77)}…` : t;
};

const toRow = (conversationId, item) => ({
  conversation_id: conversationId,
  question: String(item.question).slice(0, 300),
  standalone: item.standalone ? String(item.standalone).slice(0, 300) : null,
  sql: item.sql || null,
  note: item.note || null,
  answer: item.answer || null,
  error: item.error ? String(item.error).slice(0, 600) : null,
  cannot: !!item.cannot,
  columns: item.columns || null,
  kinds: item.kinds || null,
  rows: item.rows ? item.rows.slice(0, ROWS_SAVED) : null,
  followups: Array.isArray(item.followups) && item.followups.length ? item.followups.slice(0, 3) : null,
});

const fromRow = (r) => ({
  question: r.question, standalone: r.standalone, sql: r.sql, note: r.note, answer: r.answer,
  error: r.error, cannot: r.cannot, columns: r.columns, kinds: r.kinds, rows: r.rows, followups: r.followups || [], saved: true,
});

export async function listConversations() {
  const sb = await getClient();
  return check(await sb.from('conversations').select('id, title, updated_at').order('updated_at', { ascending: false }).limit(200));
}

export async function loadConversation(id) {
  const sb = await getClient();
  const conv = check(await sb.from('conversations').select('id, title').eq('id', id).maybeSingle());
  if (!conv) return null;
  const turns = check(await sb.from('turns').select('*').eq('conversation_id', id).order('id'));
  return { ...conv, turns: turns.map(fromRow) };
}

// Saves the given turns, creating the conversation first if needed. Returns the conversation id.
export async function saveTurns(conversationId, items) {
  const sb = await getClient();
  let id = conversationId;
  if (!id) {
    const conv = check(await sb.from('conversations').insert({ title: titleOf(items[0]) }).select('id').single());
    id = conv.id;
  }
  if (items.length) {
    const rows = items.map((it) => toRow(id, it));
    let res = await sb.from('turns').insert(rows);
    // Databases set up before follow-ups were saved don't have the column yet: save without it.
    if (res.error && /followups/i.test(res.error.message || '')) {
      res = await sb.from('turns').insert(rows.map(({ followups, ...rest }) => rest)); // eslint-disable-line no-unused-vars
    }
    check(res);
  }
  return id;
}

export async function renameConversation(id, title) {
  const sb = await getClient();
  check(await sb.from('conversations').update({ title: title.trim().slice(0, 120) || 'Conversation' }).eq('id', id));
}

export async function deleteConversation(id) {
  const sb = await getClient();
  check(await sb.from('conversations').delete().eq('id', id));
}
