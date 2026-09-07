-- 予約の空き判定（前後1時間バッファ）を DB 側でも行う
-- SQL Editor で一度実行してください。

create or replace function public.is_car_available(
  p_car_type text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_buffer_hours double precision default 1
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stock int := 0;
  overlapping int := 0;
  buffer_interval interval;
begin
  if p_car_type is null or p_start_at is null or p_end_at is null or p_start_at >= p_end_at then
    return false;
  end if;

  buffer_interval := make_interval(secs => greatest(p_buffer_hours, 0) * 3600);

  select coalesce((fleet ->> p_car_type)::int, 0)
    into stock
  from public.app_settings
  where id = 1;

  if stock is null or stock <= 0 then
    return false;
  end if;

  -- 境界含む: 次枠のちょうど1時間前の返却／ちょうど1時間後の開始も不可
  select count(*)::int
    into overlapping
  from public.reservations r
  where r.car_type = p_car_type
    and r.status is distinct from 'キャンセル'
    and p_start_at <= (r.end_at + buffer_interval)
    and p_end_at >= (r.start_at - buffer_interval);

  return overlapping < stock;
end;
$$;

grant execute on function public.is_car_available(text, timestamptz, timestamptz, double precision)
  to anon, authenticated;
