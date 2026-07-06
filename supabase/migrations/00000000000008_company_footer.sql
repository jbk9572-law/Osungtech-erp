-- 명세표 하단 인사말 및 이메일
alter table public.company_profile
  add column if not exists email text,
  add column if not exists greeting_message text default '오늘 하루도 행복하십시요.';
