-- SQL Editor で一度だけ実行してください（公開ページの読み込みエラー対策）

insert into public.app_settings (id)
values (1)
on conflict (id) do nothing;

drop policy if exists "app_settings_insert_auth" on public.app_settings;
create policy "app_settings_insert_auth"
  on public.app_settings for insert
  to authenticated
  with check (true);

grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;
