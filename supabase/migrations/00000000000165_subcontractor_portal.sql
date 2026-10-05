-- 다단계 하청 구조 지원: 본청(A) -> 우리(B) -> 하청업체(C)로 공정 일부를
-- 넘기는 경우(예: PCB 공정)를 위해, 거래처 포털과 같은 방식(직원이
-- 발급하는 아이디+비밀번호)으로 로그인하는 업체(C) 포털 계정을 추가한다.
-- 공정 단계(work_order_process_steps)는 이제 내부 공정뿐 아니라 특정
-- 업체에게 배정할 수 있고, 상태도 "대기 -> 시작 -> 완료 -> 배송"
-- (LOT이 다음 단계/다음 업체로 넘어가는 것까지) 4단계로 넓힌다 —
-- 사내공정이든 외부 업체든 같은 상태 모델을 쓴다.

-- ── 업체(하청) 마스터 ───────────────────────────────────────────

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  memo text,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);
create index if not exists subcontractors_tenant_id_idx on public.subcontractors (tenant_id);
alter table public.subcontractors enable row level security;

drop policy if exists "subcontractors_select_authenticated" on public.subcontractors;
create policy "subcontractors_select_authenticated" on public.subcontractors
  for select using (auth.role() = 'authenticated');
drop policy if exists "subcontractors_insert_authenticated" on public.subcontractors;
create policy "subcontractors_insert_authenticated" on public.subcontractors
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "subcontractors_update_authenticated" on public.subcontractors;
create policy "subcontractors_update_authenticated" on public.subcontractors
  for update using (auth.role() = 'authenticated');
drop policy if exists "subcontractors_delete_authenticated" on public.subcontractors;
create policy "subcontractors_delete_authenticated" on public.subcontractors
  for delete using (auth.role() = 'authenticated');

drop policy if exists "subcontractors_demo_isolation" on public.subcontractors;
create policy "subcontractors_demo_isolation" on public.subcontractors
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
drop policy if exists "subcontractors_tenant_isolation" on public.subcontractors;
create policy "subcontractors_tenant_isolation" on public.subcontractors
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- ── 포털 계정 테이블을 거래처/업체 공용으로 확장 ────────────────
-- 새 테이블을 또 만드는 대신(거래처 포털과 로그인/발급 방식이 완전히
-- 같으므로) customer_portal_accounts에 kind 구분과 subcontractor_id를
-- 추가해 재사용한다 — get_portal_email_for_username()을 비롯해 이미
-- username 전역 유니크 제약으로 만든 "아이디 로그인" 메커니즘을 그대로
-- 쓸 수 있다.
alter table public.customer_portal_accounts
  alter column customer_id drop not null,
  add column if not exists kind text not null default 'customer' check (kind in ('customer', 'subcontractor')),
  add column if not exists subcontractor_id uuid references public.subcontractors (id) on delete cascade;

create index if not exists customer_portal_accounts_subcontractor_id_idx
  on public.customer_portal_accounts (subcontractor_id);

alter table public.customer_portal_accounts
  drop constraint if exists customer_portal_accounts_kind_target_check;
alter table public.customer_portal_accounts
  add constraint customer_portal_accounts_kind_target_check
  check (
    (kind = 'customer' and customer_id is not null and subcontractor_id is null) or
    (kind = 'subcontractor' and subcontractor_id is not null and customer_id is null)
  );

-- handle_new_user(): portal_subcontractor_id 분기를 추가한다(나머지는
-- migration 162와 동일).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_new_tenant_name text;
  v_new_tenant_slug text;
  v_is_new_tenant boolean := false;
  v_portal_customer_id uuid;
  v_portal_subcontractor_id uuid;
begin
  v_portal_customer_id := nullif(new.raw_user_meta_data ->> 'portal_customer_id', '')::uuid;

  if v_portal_customer_id is not null then
    select tenant_id into v_tenant_id from public.customers where id = v_portal_customer_id;
    if v_tenant_id is null then
      raise exception '거래처를 찾을 수 없어 포털 계정을 만들 수 없습니다.';
    end if;

    insert into public.customer_portal_accounts (user_id, kind, customer_id, username, tenant_id, email)
    values (
      new.id, 'customer', v_portal_customer_id,
      coalesce(new.raw_user_meta_data ->> 'username', new.email),
      v_tenant_id,
      new.email
    );

    return new;
  end if;

  v_portal_subcontractor_id := nullif(new.raw_user_meta_data ->> 'portal_subcontractor_id', '')::uuid;

  if v_portal_subcontractor_id is not null then
    select tenant_id into v_tenant_id from public.subcontractors where id = v_portal_subcontractor_id;
    if v_tenant_id is null then
      raise exception '업체를 찾을 수 없어 포털 계정을 만들 수 없습니다.';
    end if;

    insert into public.customer_portal_accounts (user_id, kind, subcontractor_id, username, tenant_id, email)
    values (
      new.id, 'subcontractor', v_portal_subcontractor_id,
      coalesce(new.raw_user_meta_data ->> 'username', new.email),
      v_tenant_id,
      new.email
    );

    return new;
  end if;

  v_tenant_id := nullif(new.raw_user_meta_data ->> 'tenant_id', '')::uuid;
  v_new_tenant_name := nullif(new.raw_user_meta_data ->> 'new_tenant_name', '');
  v_new_tenant_slug := nullif(new.raw_user_meta_data ->> 'new_tenant_slug', '');

  if v_tenant_id is null and v_new_tenant_name is not null then
    insert into public.tenants (name, slug)
    values (v_new_tenant_name, v_new_tenant_slug)
    returning id into v_tenant_id;
    v_is_new_tenant := true;
  end if;

  if v_tenant_id is null then
    raise exception
      '계정 생성 시 user_metadata에 tenant_id(기존 테넌트 합류) 또는 new_tenant_name+new_tenant_slug(신규 테넌트 생성)가 반드시 필요합니다.';
  end if;

  insert into public.tenant_members (tenant_id, user_id)
  values (v_tenant_id, new.id)
  on conflict (user_id) do nothing;

  insert into public.profiles (id, full_name, email, username, tenant_id)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'username',
    v_tenant_id
  );

  if v_is_new_tenant then
    insert into public.company_profile (tenant_id, name)
    values (v_tenant_id, v_new_tenant_name);

    insert into public.document_templates (tenant_id, category, name, body)
    select v_tenant_id, d.category, d.name, d.body
    from public.default_document_templates() d;
  end if;

  return new;
end;
$$;

-- 로그인/포털 셸 공통으로 쓸 수 있는 "이 계정이 어떤 포털 계정인가"
-- 통합 조회 — 거래처/업체 양쪽을 한 번에 확인해 로그인 라우팅에서
-- 왕복을 하나로 줄인다.
create or replace function public.portal_identity()
returns table (kind text, display_name text, username text)
language sql
security definer set search_path = public
stable
as $$
  select 'customer', c.name, a.username
  from public.customer_portal_accounts a
  join public.customers c on c.id = a.customer_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'customer'
  union all
  select 'subcontractor', sc.name, a.username
  from public.customer_portal_accounts a
  join public.subcontractors sc on sc.id = a.subcontractor_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor';
$$;

revoke all on function public.portal_identity() from public;
grant execute on function public.portal_identity() to authenticated;

create or replace function public.subcontractor_whoami()
returns table (subcontractor_id uuid, subcontractor_name text, username text)
language sql
security definer set search_path = public
stable
as $$
  select sc.id, sc.name, a.username
  from public.customer_portal_accounts a
  join public.subcontractors sc on sc.id = a.subcontractor_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor';
$$;

revoke all on function public.subcontractor_whoami() from public;
grant execute on function public.subcontractor_whoami() to authenticated;

-- ── 공정 단계: 내부/업체 공통 배정 + LOT 배송 상태 ──────────────

alter table public.work_order_process_steps
  add column if not exists assignee_kind text not null default 'internal' check (assignee_kind in ('internal', 'subcontractor')),
  add column if not exists subcontractor_id uuid references public.subcontractors (id) on delete set null,
  add column if not exists shipped_at timestamptz;

alter table public.work_order_process_steps
  drop constraint if exists work_order_process_steps_assignee_check;
alter table public.work_order_process_steps
  add constraint work_order_process_steps_assignee_check
  check (
    (assignee_kind = 'internal' and subcontractor_id is null) or
    (assignee_kind = 'subcontractor' and subcontractor_id is not null)
  );

alter table public.work_order_process_steps
  drop constraint if exists work_order_process_steps_status_check;
alter table public.work_order_process_steps
  add constraint work_order_process_steps_status_check
  check (status in ('pending', 'in_progress', 'done', 'shipped'));

-- 공정 단계를 업체에 배정/해제(사내 직원만 — 생산관리 화면에서 사용).
create or replace function public.assign_work_order_process_step(p_id uuid, p_subcontractor_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  if p_subcontractor_id is null then
    update public.work_order_process_steps
    set assignee_kind = 'internal', subcontractor_id = null
    where id = p_id and tenant_id = public.current_tenant_id();
  else
    if not exists (
      select 1 from public.subcontractors
      where id = p_subcontractor_id and tenant_id = public.current_tenant_id()
    ) then
      raise exception '업체를 찾을 수 없습니다.';
    end if;

    update public.work_order_process_steps
    set assignee_kind = 'subcontractor', subcontractor_id = p_subcontractor_id
    where id = p_id and tenant_id = public.current_tenant_id();
  end if;

  if not found then
    raise exception '공정 단계를 찾을 수 없습니다.';
  end if;
end;
$$;

revoke all on function public.assign_work_order_process_step(uuid, uuid) from public;
grant execute on function public.assign_work_order_process_step(uuid, uuid) to authenticated;

-- 기존 update_work_order_process_step(): 'shipped' 상태를 추가로 허용하고,
-- completed_at/shipped_at을 상태 전이에 맞게 갱신한다.
create or replace function public.update_work_order_process_step(p_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_status not in ('pending', 'in_progress', 'done', 'shipped') then
    raise exception '올바르지 않은 상태 값입니다.';
  end if;

  update public.work_order_process_steps
  set status = p_status,
      started_at = case when p_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when p_status in ('done', 'shipped') then coalesce(completed_at, now()) else null end,
      shipped_at = case when p_status = 'shipped' then now() else null end
  where id = p_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception '공정 단계를 찾을 수 없습니다.';
  end if;
end;
$$;

-- 업체 포털에서 자기에게 배정된 단계만 상태를 바꾸는 전용 함수 — 사내용
-- update_work_order_process_step()은 tenant_id = current_tenant_id()로
-- 막혀 있어 업체 포털 세션(tenant_members 없음)은 애초에 호출해도 0건만
-- 바뀐다. "시작/완료/배송"만 가능하고(대기로 되돌리는 건 사내 담당자만),
-- 자기 업체에 배정된 단계가 아니면 조용히 실패(0 rows)가 아니라 예외를
-- 던진다.
create or replace function public.subcontractor_update_step_status(p_step_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_account record;
begin
  select a.id, a.subcontractor_id into v_account
  from public.customer_portal_accounts a
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor';

  if v_account is null then
    raise exception '업체 포털 계정을 확인할 수 없습니다.';
  end if;
  if p_status not in ('in_progress', 'done', 'shipped') then
    raise exception '올바르지 않은 상태 값입니다.';
  end if;

  update public.work_order_process_steps
  set status = p_status,
      started_at = case when p_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when p_status in ('done', 'shipped') then coalesce(completed_at, now()) else completed_at end,
      shipped_at = case when p_status = 'shipped' then now() else shipped_at end
  where id = p_step_id
    and assignee_kind = 'subcontractor'
    and subcontractor_id = v_account.subcontractor_id;

  if not found then
    raise exception '배정된 공정 단계를 찾을 수 없습니다.';
  end if;
end;
$$;

revoke all on function public.subcontractor_update_step_status(uuid, text) from public;
grant execute on function public.subcontractor_update_step_status(uuid, text) to authenticated;

-- 업체 포털: 자신에게 배정된 공정이 있는 생산지시 목록(=전체 흐름을
-- 볼 수 있어야 하므로 "자기 단계만"이 아니라 그 생산지시 전체를 노출).
create or replace function public.subcontractor_list_work_orders()
returns table (
  id uuid, doc_no bigint, product_name text, quantity numeric, status text,
  order_date date, created_at timestamptz
)
language sql
security definer set search_path = public
stable
as $$
  select distinct wo.id, wo.doc_no, p.name, wo.quantity, wo.status, wo.order_date, wo.created_at
  from public.customer_portal_accounts a
  join public.work_order_process_steps s
    on s.assignee_kind = 'subcontractor' and s.subcontractor_id = a.subcontractor_id
  join public.work_orders wo on wo.id = s.work_order_id
  join public.products p on p.id = wo.product_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor'
  order by wo.created_at desc;
$$;

revoke all on function public.subcontractor_list_work_orders() from public;
grant execute on function public.subcontractor_list_work_orders() to authenticated;

create or replace function public.subcontractor_get_work_order(p_work_order_id uuid)
returns table (id uuid, doc_no bigint, product_name text, quantity numeric, status text, order_date date, memo text)
language sql
security definer set search_path = public
stable
as $$
  select wo.id, wo.doc_no, p.name, wo.quantity, wo.status, wo.order_date, wo.memo
  from public.customer_portal_accounts a
  join public.work_orders wo on wo.id = p_work_order_id
  join public.products p on p.id = wo.product_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor'
    and exists (
      select 1 from public.work_order_process_steps s2
      where s2.work_order_id = wo.id
        and s2.assignee_kind = 'subcontractor'
        and s2.subcontractor_id = a.subcontractor_id
    );
$$;

revoke all on function public.subcontractor_get_work_order(uuid) from public;
grant execute on function public.subcontractor_get_work_order(uuid) to authenticated;

-- 공정 전체 흐름(사용자 확정 사항: 업체는 자기 단계뿐 아니라 그 생산지시의
-- 전체 공정 흐름을 볼 수 있어야 한다) + is_mine으로 자기 단계만 버튼 노출.
create or replace function public.subcontractor_get_work_order_steps(p_work_order_id uuid)
returns table (
  id uuid, process_name text, sort_order int, status text,
  assignee_kind text, subcontractor_name text,
  started_at timestamptz, completed_at timestamptz, shipped_at timestamptz,
  is_mine boolean
)
language sql
security definer set search_path = public
stable
as $$
  select s.id, s.process_name, s.sort_order, s.status,
         s.assignee_kind, sc.name,
         s.started_at, s.completed_at, s.shipped_at,
         (s.assignee_kind = 'subcontractor' and s.subcontractor_id = a.subcontractor_id)
  from public.customer_portal_accounts a
  join public.work_order_process_steps s on s.work_order_id = p_work_order_id
  left join public.subcontractors sc on sc.id = s.subcontractor_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor'
    and exists (
      select 1 from public.work_order_process_steps s2
      where s2.work_order_id = p_work_order_id
        and s2.assignee_kind = 'subcontractor'
        and s2.subcontractor_id = a.subcontractor_id
    )
  order by s.sort_order;
$$;

revoke all on function public.subcontractor_get_work_order_steps(uuid) from public;
grant execute on function public.subcontractor_get_work_order_steps(uuid) to authenticated;
