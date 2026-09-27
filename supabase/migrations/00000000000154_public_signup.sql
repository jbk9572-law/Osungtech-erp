-- 공개 회원가입(누구나 /signup에서 바로 테넌트+관리자 계정을 만들 수 있는
-- 셀프서비스 가입) 도입. 지금까지는(migration 121 주석 참고) 모든 계정이
-- 플랫폼 운영자가 platform-admin 화면에서 직접 만들어줘야만 생겼는데,
-- 실제로 돈을 받고 파는 SaaS로 전환하려면 사람이 매번 개입하지 않아도
-- 가입이 되어야 한다.

-- 1) 가입 시 받는 실제 연락 이메일. 로그인 자체는 여전히 회사코드+아이디
--    (합성 이메일 username@slug.elvonix.local, migration 98/121)라 이
--    컬럼은 로그인 자격증명이 아니라 순수 연락처/공지 발송용이다.
alter table public.tenants add column if not exists contact_email text;

-- 2) IP 기준 가입 시도 기록 — 자동화 도구가 짧은 시간에 계정을 대량으로
--    찍어내는 걸 막기 위한 앱 레벨 최후 방어선(1차 방어는 클라우드플레어
--    Bot Fight Mode/WAF rate-limit 규칙이 엣지에서 처리하고, 여긴 그걸
--    보완하는 2차 방어다). service_role(서버 액션의 admin 클라이언트)만
--    쓰므로 anon/authenticated용 select/insert 정책은 두지 않는다 —
--    RLS를 켜두면 정책이 없을 때 기본이 "전부 거부"라 그 자체로 안전하다.
create table if not exists public.signup_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists signup_attempts_ip_created_idx on public.signup_attempts (ip, created_at);

alter table public.signup_attempts enable row level security;

-- 오래된 기록이 무한히 쌓이지 않도록, 가입 액션에서 매번 24시간 이전
-- 기록을 지운다(별도 배치/cron 없이 요청 시점에 청소 — 트래픽이 이
-- 테이블에 쓰기를 할 때만 커지므로 이 정도로 충분하다).
