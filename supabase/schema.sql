-- CricStats accounts: saved Ask conversations.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste this file -> Run.
-- Safe to run again (it only creates what's missing and replaces the policies and functions).
--
-- Sign-in itself is handled by Supabase Auth (Google). These tables hold each user's conversations.
-- Row-level security means every user can only ever read or change their own rows, even though the
-- browser talks to the database directly with the public "anon" key.

create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists conversations_user_updated on public.conversations (user_id, updated_at desc);

create table if not exists public.turns (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question         text not null check (char_length(question) between 1 and 300),
  standalone       text check (char_length(standalone) <= 300),
  sql              text check (char_length(sql) <= 8000),
  note             text check (char_length(note) <= 600),
  answer           text check (char_length(answer) <= 1200),
  error            text check (char_length(error) <= 600),
  cannot           boolean not null default false,
  columns          jsonb,
  kinds            jsonb,
  rows             jsonb check (rows is null or pg_column_size(rows) <= 60000), -- first 50 rows of the result
  created_at       timestamptz not null default now()
);
create index if not exists turns_conversation on public.turns (conversation_id, id);

-- Added later: the follow-up suggestions shown under each answer (up to 3 short questions).
alter table public.turns add column if not exists followups jsonb
  check (followups is null or (jsonb_typeof(followups) = 'array' and jsonb_array_length(followups) <= 5 and pg_column_size(followups) <= 2000));

alter table public.conversations enable row level security;
alter table public.turns enable row level security;

drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own turns" on public.turns;
create policy "own turns" on public.turns
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );

-- Guests (anon) get nothing.
revoke all on public.conversations, public.turns from anon;
grant select, insert, update, delete on public.conversations, public.turns to authenticated;

-- Limits: 200 conversations per user, 100 questions per conversation.
create or replace function public.enforce_limits() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'conversations' then
    if (select count(*) from public.conversations where user_id = new.user_id) >= 200 then
      raise exception 'You have 200 saved conversations. Delete some to save new ones.';
    end if;
  else
    if (select count(*) from public.turns where conversation_id = new.conversation_id) >= 100 then
      raise exception 'This conversation is full (100 questions). Start a new one.';
    end if;
    update public.conversations set updated_at = now() where id = new.conversation_id;
  end if;
  return new;
end $$;

drop trigger if exists conversations_limit on public.conversations;
create trigger conversations_limit before insert on public.conversations
  for each row execute function public.enforce_limits();
drop trigger if exists turns_limit on public.turns;
create trigger turns_limit before insert on public.turns
  for each row execute function public.enforce_limits();

-- "Delete my account": removes the sign-in and, through the cascades above, every conversation.
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
