-- 실패 로그: 사용자가 겪은 뮤테이션 실패(삭제가 막힘, 등록/수정 실패 등)를
-- CODE + 한글설명으로 남겨서, 플랫폼관리자가 스크린샷을 기다리지 않고도
-- "왜 실패했는지"를 바로 확인할 수 있게 한다(사용자 요청: 매입 전표
-- 삭제가 막혔던 걸 계기로, 삭제뿐 아니라 입력 실패 등도 코드+한글설명을
-- 남기길 원함).
--
-- audit_logs(migration 74)는 "성공한" 변경만 기록한다 — 실패는 대부분
-- raise exception으로 트랜잭션이 롤백돼 트리거 자체가 안 돈다. 그래서
-- 이 테이블은 반대로, 서버 액션이 에러를 받은 바로 그 자리에서 직접
-- insert하는 방식으로만 채워진다(공용 헬퍼 src/lib/log-operation-failure.ts
-- 의 logOperationFailure()가 담당 — 로그 적재 자체가 실패해도 원래
-- 하던 작업(에러 메시지를 화면에 보여주는 것)은 절대 막지 않는다).
--
-- 지금 당장 모든 뮤테이션(63개 파일, 777곳)에 전부 거는 건 비현실적이고
-- 위험해서, 매입/매출 삭제처럼 핵심 뮤테이션부터 먼저 걸고 점진적으로
-- 넓힌다 — 테이블/뷰어 자체는 처음부터 범용으로 만들어서, 나중에 다른
-- 화면이 호출하기만 하면 바로 같이 보인다.
create table public.failure_logs (
  id uuid primary key default gen_random_uuid(),
  -- 기계가 보기 좋은 식별자(영문 대문자+언더스코어, 예:
  -- "PURCHASE_DELETE_BLOCKED_FIFO_CONSUMED") — 같은 원인이면 여러 번
  -- 발생해도 항상 같은 code라서, 플랫폼관리자 화면에서 "이 실패가 몇 번
  -- 반복됐는지" 코드 기준으로 묶어볼 수 있다.
  code text not null,
  -- 그 code에 대한 한글 설명. 화면에 실제로 떴던 에러 문구를 그대로
  -- 쓰는 경우가 많지만(detail과 중복될 수 있음), "사람이 읽는 설명"이라는
  -- 역할이 다르다 — detail은 DB가 내려준 원문(디버깅용), message_ko는
  -- 운영자가 바로 이해할 한 줄 요약.
  message_ko text not null,
  -- 어떤 작업을 하려다 실패했는지(예: "purchase_delete",
  -- "sale_create") — 화면/기능 단위 식별자, 자유 텍스트.
  action text not null,
  entity_type text,
  entity_id uuid,
  -- Postgres가 실제로 내려준 원문 에러 메시지(error.message) — code/
  -- message_ko로 분류가 안 되는 새로운 실패 유형이 나왔을 때 원인을
  -- 추적할 단서로 남겨둔다.
  detail text,
  context jsonb,
  actor uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade
);

create index failure_logs_tenant_created_idx on public.failure_logs (tenant_id, created_at desc);
create index failure_logs_code_idx on public.failure_logs (code);

alter table public.failure_logs enable row level security;

create policy "failure_logs_tenant_isolation" on public.failure_logs
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "failure_logs_demo_isolation" on public.failure_logs
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

-- 실패를 겪은 당사자가 아니라도(관리자가) 바로 볼 수 있어야 하므로
-- select는 관리자 전용 — audit_logs와 같은 기준(public.is_admin()).
create policy "failure_logs_select_admin" on public.failure_logs
  for select using (public.is_admin());

-- insert는 실패를 겪은 로그인 사용자 본인이 그 자리에서 직접 남기므로
-- 인증된 사용자 전체에게 열어둔다 — tenant_id/is_demo는 위 default로
-- 자동 채워지므로 호출부가 신경 쓸 필요 없다.
create policy "failure_logs_insert_authenticated" on public.failure_logs
  for insert with check (auth.role() = 'authenticated');

-- get_cross_tenant_activity_log(migration 129)과 같은 이유로 같은 패턴:
-- failure_logs도 테넌트별로 격리돼 있어 플랫폼 운영자가 그냥은 남의
-- 테넌트 실패 로그를 못 본다 — SECURITY DEFINER RPC로 이 함수 안에서만
-- 우회한다.
create or replace function public.get_cross_tenant_failure_log(p_limit integer default 200)
returns table (
  id uuid,
  tenant_name text,
  code text,
  message_ko text,
  action text,
  entity_type text,
  detail text,
  actor_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 조회할 수 있습니다.';
  end if;

  return query
    select fl.id, t.name as tenant_name, fl.code, fl.message_ko, fl.action, fl.entity_type,
           fl.detail, p.full_name as actor_name, fl.created_at
    from public.failure_logs fl
    left join public.tenants t on t.id = fl.tenant_id
    left join public.profiles p on p.id = fl.actor
    where fl.is_demo = false
    order by fl.created_at desc
    limit p_limit;
end;
$$;

revoke all on function public.get_cross_tenant_failure_log(integer) from public;
grant execute on function public.get_cross_tenant_failure_log(integer) to authenticated;
