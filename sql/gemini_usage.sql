-- Run once in the Supabase SQL editor. Never expose the service role key to a browser.
create table if not exists public.meong_gemini_state (
  id boolean primary key default true check (id),
  current_model text not null default 'gemini-3.5-flash-lite',
  switched_at timestamptz,
  switch_reason text
);
insert into public.meong_gemini_state(id) values (true) on conflict do nothing;

create table if not exists public.meong_gemini_calls (
  id uuid primary key,
  model text not null,
  pacific_day date not null,
  phase text not null check (phase in ('initial', 'continuation', 'retry')),
  reserved_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null default 'reserved' check (outcome in ('reserved','success','error','cancelled','timeout','not_sent')),
  error_code text
);
create index if not exists meong_gemini_calls_day_model_idx on public.meong_gemini_calls(pacific_day, model);
alter table public.meong_gemini_state enable row level security;
alter table public.meong_gemini_calls enable row level security;
revoke all on public.meong_gemini_state, public.meong_gemini_calls from public, anon, authenticated;

create or replace function public.meong_gemini_reserve(p_id uuid, p_phase text)
returns table(model text) language plpgsql security definer set search_path = pg_catalog, public as $$
declare chosen text; daily_count bigint; today date := (clock_timestamp() at time zone 'America/Los_Angeles')::date;
begin
  select current_model into chosen from public.meong_gemini_state where id = true for update;
  if chosen is null then raise exception 'Gemini state missing'; end if;
  if chosen = 'gemini-3.5-flash-lite' then
    select count(*) into daily_count from public.meong_gemini_calls where pacific_day = today and meong_gemini_calls.model = chosen and outcome <> 'not_sent';
    if daily_count >= 500 then
      chosen := 'gemini-3.1-flash-lite';
      update public.meong_gemini_state set current_model = chosen, switched_at = clock_timestamp(), switch_reason = 'daily_limit' where id = true;
    end if;
  end if;
  insert into public.meong_gemini_calls(id, model, pacific_day, phase) values (p_id, chosen, today, p_phase);
  return query select chosen;
end $$;

create or replace function public.meong_gemini_finish(p_id uuid, p_outcome text, p_error_code text, p_daily_quota boolean)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare call_model text;
begin
  update public.meong_gemini_calls set outcome = p_outcome, error_code = p_error_code, finished_at = clock_timestamp()
    where id = p_id and outcome = 'reserved' returning model into call_model;
  if p_daily_quota and call_model = 'gemini-3.5-flash-lite' then
    update public.meong_gemini_state set current_model = 'gemini-3.1-flash-lite', switched_at = clock_timestamp(), switch_reason = 'provider_daily_quota'
      where id = true and current_model = 'gemini-3.5-flash-lite';
  end if;
end $$;

create or replace function public.meong_gemini_status()
returns jsonb language sql security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object('currentModel', s.current_model, 'switchedAt', s.switched_at, 'switchReason', s.switch_reason,
    'today', count(*) filter (where c.pacific_day = (clock_timestamp() at time zone 'America/Los_Angeles')::date and c.model = s.current_model and c.outcome <> 'not_sent'),
    'primaryToday', count(*) filter (where c.pacific_day = (clock_timestamp() at time zone 'America/Los_Angeles')::date and c.model = 'gemini-3.5-flash-lite' and c.outcome <> 'not_sent'),
    'total', count(*) filter (where c.outcome <> 'not_sent'),
    'errors', count(*) filter (where c.outcome = 'error'),
    'cancelled', count(*) filter (where c.outcome = 'cancelled'),
    'timeouts', count(*) filter (where c.outcome = 'timeout'),
    'pending', count(*) filter (where c.outcome = 'reserved'),
    'notSent', count(*) filter (where c.outcome = 'not_sent'),
    'retries', count(*) filter (where c.phase = 'retry'),
    'daily', (select coalesce(jsonb_agg(to_jsonb(d) order by d.day desc), '[]'::jsonb) from (
      select pacific_day as day, model, count(*) as calls,
        count(*) filter (where outcome = 'error') as errors,
        count(*) filter (where outcome = 'cancelled') as cancelled,
        count(*) filter (where outcome = 'timeout') as timeouts,
        count(*) filter (where phase = 'retry') as retries
      from public.meong_gemini_calls where outcome <> 'not_sent'
      group by pacific_day, model order by pacific_day desc limit 60
    ) d))
  from public.meong_gemini_state s left join public.meong_gemini_calls c on true where s.id = true group by s.id;
$$;

-- Reset changes the selected model only. It never erases history or bypasses today's limit.
create or replace function public.meong_gemini_reset()
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform 1 from public.meong_gemini_state where id = true for update;
  if (select count(*) from public.meong_gemini_calls where pacific_day = (clock_timestamp() at time zone 'America/Los_Angeles')::date and model = 'gemini-3.5-flash-lite' and outcome <> 'not_sent') >= 500 then
    raise exception 'Primary daily limit already reached';
  end if;
  update public.meong_gemini_state set current_model = 'gemini-3.5-flash-lite' where id = true;
end $$;

revoke all on function public.meong_gemini_reserve(uuid,text), public.meong_gemini_finish(uuid,text,text,boolean), public.meong_gemini_status(), public.meong_gemini_reset() from public, anon, authenticated;
grant execute on function public.meong_gemini_reserve(uuid,text), public.meong_gemini_finish(uuid,text,text,boolean), public.meong_gemini_status(), public.meong_gemini_reset() to service_role;
