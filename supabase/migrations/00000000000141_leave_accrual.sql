-- 연차 자동 발생(근로기준법 60조 기준 계산)과 연차 사용촉진 제도(근로기준법
-- 61조 — 미사용 연차를 회사가 서면으로 통지해 수당 지급 의무를 면하는 제도)를
-- 지원하기 위한 기반. 자동 계산 자체는 순수 함수(src/lib/leave-accrual.ts)로
-- 하고, 여기서는 그 계산의 입력값(입사일)과 촉진 통지를 보낸 이력만 저장한다.

-- 입사일 — 연차 자동 계산(입사일 기준 만근속연수)의 유일한 입력값. 지금까지는
-- 관리자가 연차 총일수를 손으로만 넣었는데(hr/leave-balances 페이지 안내문
-- 참고), 이 컬럼이 생기면서 "자동 계산값을 보여주고 적용은 선택"하는 방식으로
-- 바뀐다 — 계산값을 강제로 덮어쓰지 않아 회사마다 다른 특수 합의(예: 경력
-- 인정 가산)를 그대로 유지할 수 있다.
alter table public.profiles add column hire_date date;

-- 연차 사용촉진 1차/2차 통지를 보낸 기록. 통지 자체(문구·발송 채널)는 이
-- 테이블이 하는 일이 아니고, "회사가 이 시점에 이 직원에게 잔여 며칠을
-- 통지했다"는 증빙만 남긴다 — 실제 법적 효력을 위해서는 이 기록이 곧 증거가
-- 된다.
create table public.leave_promotion_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  is_demo boolean not null default public.is_demo_actor(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  year integer not null,
  -- 1차(사용기한 6개월 전, 근로자에게 사용 시기 회신 요청) /
  -- 2차(사용기한 2개월 전, 회사가 사용 시기를 지정해 통보).
  stage smallint not null check (stage in (1, 2)),
  remaining_days numeric not null,
  sent_by uuid references public.profiles (id) on delete set null,
  sent_at timestamptz not null default now(),
  unique (user_id, year, stage)
);

create index leave_promotion_notices_user_id_idx on public.leave_promotion_notices (user_id);
create index leave_promotion_notices_tenant_id_idx on public.leave_promotion_notices (tenant_id);

alter table public.leave_promotion_notices enable row level security;

create policy "leave_promotion_notices_tenant_isolation" on public.leave_promotion_notices
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy "leave_promotion_notices_demo_isolation" on public.leave_promotion_notices
  as restrictive for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

-- 본인 몫 통지는 누구나 조회할 수 있다(연차관리 화면 밖에서도 "나에게 온
-- 촉진 통지"를 보여줄 수 있게) — 발송(insert)은 인사관리 권한자만 서버
-- 액션에서 하므로 별도 insert 정책은 두지 않고 관리자 전용 조회만 더한다.
create policy "leave_promotion_notices_own_read" on public.leave_promotion_notices
  for select
  using (auth.role() = 'authenticated' and user_id = auth.uid());

create policy "leave_promotion_notices_admin_all" on public.leave_promotion_notices
  for all
  using (
    auth.role() = 'authenticated'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    auth.role() = 'authenticated'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
