import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Runs supabase/schema.sql in an in-memory Postgres with a minimal stand-in for Supabase's auth schema,
// then checks that row-level security keeps every user to their own conversations.
test('schema: users only reach their own conversations; limits and account deletion work', { timeout: 120000 }, async () => {
  const ok = (label, cond) => assert.ok(cond, label);
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x'), ('22222222-2222-2222-2222-222222222222','b@x');
  `);
  await db.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  await db.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')); // re-runnable
  const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
  const as = async (uid, sql, params) => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
    try { return (await db.query(sql, params)).rows; } catch (e) { return 'ERR: ' + e.message.split('\n')[0]; } finally { await db.exec('reset role'); }
  };

  const c = await as(A, `insert into conversations (title) values ('A chat') returning id, user_id`);
  ok('A creates conversation, user_id defaults to A', c[0].user_id === A);
  const cid = c[0].id;
  ok('A adds a turn', Array.isArray(await as(A, `insert into turns (conversation_id, question, rows) values ($1, 'q1', '[[1,2]]') returning id`, [cid])));
  ok('A sees own conversation', (await as(A, `select * from conversations`)).length === 1);
  ok('B sees nothing of A', (await as(B, `select * from conversations`)).length === 0 && (await as(B, `select * from turns`)).length === 0);
  ok('B cannot add a turn to A conversation', String(await as(B, `insert into turns (conversation_id, question) values ($1, 'hack')`, [cid])).startsWith('ERR'));
  ok('B cannot claim user_id A', String(await as(B, `insert into conversations (user_id, title) values ($1, 'x')`, [A])).startsWith('ERR'));
  ok('B update of A is no-op', (await as(B, `update conversations set title='pwned' where id=$1 returning id`, [cid])).length === 0);
  ok('B delete of A is no-op', (await as(B, `delete from conversations where id=$1 returning id`, [cid])).length === 0);
  ok('guest (anon) cannot read', String(await as(null, `select * from conversations`)).startsWith('ERR'));
  ok('guest cannot delete accounts', String(await as(null, `select delete_my_account()`)).startsWith('ERR'));
  ok('question over 300 chars rejected', String(await as(A, `insert into turns (conversation_id, question) values ($1, repeat('x', 301))`, [cid])).startsWith('ERR'));
  const before = (await as(A, `select updated_at from conversations where id=$1`, [cid]))[0].updated_at;
  await new Promise(r => setTimeout(r, 20));
  await as(A, `insert into turns (conversation_id, question) values ($1, 'q2')`, [cid]);
  ok('adding a turn bumps updated_at', (await as(A, `select updated_at from conversations where id=$1`, [cid]))[0].updated_at > before);
  for (let i = 0; i < 98; i++) await as(A, `insert into turns (conversation_id, question) values ($1, 'q')`, [cid]);
  ok('101st question rejected', String(await as(A, `insert into turns (conversation_id, question) values ($1, 'q')`, [cid])).includes('100 questions'));
  for (let i = 0; i < 200; i++) await as(B, `insert into conversations (title) values ('b')`);
  ok('201st conversation rejected', String(await as(B, `insert into conversations (title) values ('b')`)).includes('200 saved'));
  await as(A, `select delete_my_account()`);
  ok('delete_my_account removes A and cascades', (await db.query(`select count(*)::int n from auth.users where id=$1`, [A])).rows[0].n === 0 && (await db.query(`select count(*)::int n from conversations where user_id=$1`, [A])).rows[0].n === 0 && (await db.query(`select count(*)::int n from turns where user_id=$1`, [A])).rows[0].n === 0);
  ok('B untouched', (await db.query(`select count(*)::int n from conversations where user_id=$1`, [B])).rows[0].n === 200);
});
