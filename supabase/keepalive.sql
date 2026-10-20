-- Tabela e função usadas pelo workflow .github/workflows/supabase-keepalive.yml
-- para registrar uma escrita periódica e evitar que o Supabase pause o projeto.
-- Rodar uma vez no SQL Editor do painel do Supabase.

create table if not exists public.keepalive (
  id        int primary key,
  pinged_at timestamptz not null default now(),
  pings     bigint not null default 0
);

-- RLS ligado e sem policies: ninguém acessa a tabela direto pela API.
alter table public.keepalive enable row level security;

-- A escrita acontece só por esta função (security definer), que o workflow chama via /rpc.
create or replace function public.keepalive_ping()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  insert into public.keepalive (id, pinged_at, pings)
  values (1, now(), 1)
  on conflict (id) do update
    set pinged_at = now(), pings = keepalive.pings + 1
  returning pinged_at;
$$;

revoke all on function public.keepalive_ping() from public;
grant execute on function public.keepalive_ping() to anon, authenticated;
