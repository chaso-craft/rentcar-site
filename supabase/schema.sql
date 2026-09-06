-- GOTO rental car / Supabase schema
-- SQL Editor でこのファイルをすべて実行してください。

-- 店舗設定・車両・料金（1行で管理）
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  fleet jsonb not null default '{}'::jsonb,
  catalog jsonb not null default '{}'::jsonb,
  site jsonb not null default '{}'::jsonb,
  rates jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id)
values (1)
on conflict (id) do nothing;

-- 予約
create table if not exists public.reservations (
  id text primary key,
  created_at timestamptz not null default now(),
  customer_name text not null default '',
  phone text not null default '',
  email text not null default '',
  car_type text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  start_time_selection text not null default '',
  end_time_selection text not null default '',
  start_outside_hours boolean not null default false,
  end_outside_hours boolean not null default false,
  estimated_total numeric not null default 0,
  estimated_base_total numeric not null default 0,
  estimated_option_total numeric not null default 0,
  options jsonb not null default '{}'::jsonb,
  payment_method text not null default '',
  payment_paid boolean not null default false,
  notes text not null default '',
  status text not null default '受付',
  is_read boolean not null default false
);

create index if not exists reservations_start_at_idx on public.reservations (start_at);
create index if not exists reservations_car_type_idx on public.reservations (car_type);

-- 見積書・領収書
create table if not exists public.documents (
  id text primary key,
  reservation_id text references public.reservations (id) on delete set null,
  type text not null,
  document_number text not null default '',
  issued_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists documents_reservation_id_idx on public.documents (reservation_id);
create index if not exists documents_type_idx on public.documents (type);

-- 公開向け：空き判定に必要な列だけ返す（個人情報は出さない）
create or replace function public.get_reservation_schedule()
returns table (
  id text,
  car_type text,
  start_at timestamptz,
  end_at timestamptz,
  status text
)
language sql
security definer
set search_path = public
as $$
  select id, car_type, start_at, end_at, status
  from public.reservations
  where status is distinct from 'キャンセル';
$$;

-- RLS
alter table public.app_settings enable row level security;
alter table public.reservations enable row level security;
alter table public.documents enable row level security;

-- app_settings: 誰でも読める / ログイン管理者だけ更新
drop policy if exists "app_settings_select_all" on public.app_settings;
create policy "app_settings_select_all"
  on public.app_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "app_settings_update_auth" on public.app_settings;
create policy "app_settings_update_auth"
  on public.app_settings for update
  to authenticated
  using (true)
  with check (true);

-- reservations: 予約の新規作成は誰でも / 一覧・更新・削除は管理者のみ
drop policy if exists "reservations_insert_anon" on public.reservations;
create policy "reservations_insert_anon"
  on public.reservations for insert
  to anon, authenticated
  with check (true);

drop policy if exists "reservations_select_auth" on public.reservations;
create policy "reservations_select_auth"
  on public.reservations for select
  to authenticated
  using (true);

drop policy if exists "reservations_update_auth" on public.reservations;
create policy "reservations_update_auth"
  on public.reservations for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "reservations_delete_auth" on public.reservations;
create policy "reservations_delete_auth"
  on public.reservations for delete
  to authenticated
  using (true);

-- documents
drop policy if exists "documents_insert_all" on public.documents;
create policy "documents_insert_all"
  on public.documents for insert
  to anon, authenticated
  with check (true);

drop policy if exists "documents_select_auth" on public.documents;
create policy "documents_select_auth"
  on public.documents for select
  to authenticated
  using (true);

drop policy if exists "documents_update_auth" on public.documents;
create policy "documents_update_auth"
  on public.documents for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "documents_delete_auth" on public.documents;
create policy "documents_delete_auth"
  on public.documents for delete
  to authenticated
  using (true);

grant usage on schema public to anon, authenticated;
grant select, update on public.app_settings to anon, authenticated;
grant select, insert, update, delete on public.reservations to authenticated;
grant insert on public.reservations to anon;
grant select, insert, update, delete on public.documents to authenticated;
grant insert on public.documents to anon;
grant execute on function public.get_reservation_schedule() to anon, authenticated;
