-- 261: 감사 보고에서 나온 권한/상태 구멍.
--  1) 정지·이용기간 만료 회사가 이미 로그인한 세션/포털로 계속 쓰이던 것 → current_tenant_id()가 null
--  2) 가장(impersonation) 행이 만료·권한상실 후에도 살아 있던 것 → 12시간 제한 + 플랫폼 관리자 재확인
--  3) 외주업체가 공정 상태 순서를 건너뛰던 것 → 전이 표 강제
--  4) 메신저 첨부: 타사 목록 조회 + file_path 임의 값 → 같은 회사 폴더만

-- 1)+2) current_tenant_id
create or replace function public.current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select i.tenant_id
      from public.platform_admin_impersonations i
      where i.admin_user_id = auth.uid()
        and i.ended_at is null
        and i.started_at > now() - interval '12 hours'
        and public.is_platform_admin()
    ),
    (
      select tm.tenant_id
      from public.tenant_members tm
      join public.tenants t on t.id = tm.tenant_id
      where tm.user_id = auth.uid()
        and t.disabled_at is null
        and (t.plan_expires_at is null or t.plan_expires_at >= now())
    )
  );
$$;

-- 포털 계정: 소속 회사가 정지·만료면 포털 신원 자체를 돌려주지 않는다.
create or replace function public.portal_identity()
returns table (kind text, display_name text, username text)
language sql
security definer set search_path = public
stable
as $$
  select 'customer', c.name, a.username
  from public.customer_portal_accounts a
  join public.customers c on c.id = a.customer_id
  join public.tenants t on t.id = c.tenant_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'customer'
    and t.disabled_at is null and (t.plan_expires_at is null or t.plan_expires_at >= now())
  union all
  select 'subcontractor', sc.name, a.username
  from public.customer_portal_accounts a
  join public.subcontractors sc on sc.id = a.subcontractor_id
  join public.tenants t on t.id = sc.tenant_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor'
    and t.disabled_at is null and (t.plan_expires_at is null or t.plan_expires_at >= now());
$$;

-- 레이아웃이 "정지/만료" 안내를 띄울 수 있게 사유를 같이 돌려준다(RLS 대신 definer 헬퍼).
create or replace function public.my_tenant_block_reason()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when t.disabled_at is not null then 'disabled'
    when t.plan_expires_at is not null and t.plan_expires_at < now() then 'expired'
    else null
  end
  from public.tenant_members tm
  join public.tenants t on t.id = tm.tenant_id
  where tm.user_id = auth.uid();
$$;
revoke all on function public.my_tenant_block_reason() from public;
grant execute on function public.my_tenant_block_reason() to authenticated;

-- 3) 외주 공정 상태 전이: received→in_progress→done→shipped (in_progress→shipped 도 허용).
create or replace function public.subcontractor_update_step_status(p_step_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_account record;
  v_step record;
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

  select * into v_step
  from public.work_order_process_steps
  where id = p_step_id and assignee_kind = 'subcontractor' and subcontractor_id = v_account.subcontractor_id
  for update;

  if v_step is null then
    raise exception '배정된 공정 단계를 찾을 수 없습니다.';
  end if;
  if exists (
    select 1 from public.tenants t
    where t.id = v_step.tenant_id
      and (t.disabled_at is not null or (t.plan_expires_at is not null and t.plan_expires_at < now()))
  ) then
    raise exception '이용이 정지된 회사입니다.';
  end if;

  if v_step.defect_hold then
    raise exception '입고 불량 보류 중입니다 — 원청 확인 후 진행할 수 있습니다.';
  end if;
  if p_status = 'in_progress' and v_step.status <> 'received' then
    raise exception '입고확인을 먼저 처리해주세요.';
  end if;
  if p_status = 'done' and v_step.status <> 'in_progress' then
    raise exception '진행 중인 공정만 완료할 수 있습니다.';
  end if;
  if p_status = 'shipped' and v_step.status not in ('in_progress', 'done') then
    raise exception '진행 중이거나 완료된 공정만 출고 처리할 수 있습니다.';
  end if;

  update public.work_order_process_steps
  set status = p_status,
      started_at = case when p_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when p_status in ('done', 'shipped') then coalesce(completed_at, now()) else completed_at end,
      shipped_at = case when p_status = 'shipped' then now() else shipped_at end
  where id = p_step_id;

  if p_status in ('done', 'shipped') then
    perform public.consume_subcontractor_material_for_step(p_step_id);
  end if;
end;
$$;
revoke all on function public.subcontractor_update_step_status(uuid, text) from public;
grant execute on function public.subcontractor_update_step_status(uuid, text) to authenticated;

-- 4) 메신저 첨부 버킷: 같은 회사 직원이 올린 폴더만 조회, file_path 는 같은 회사 직원 폴더만 허용.
drop policy if exists "messenger_attachments_public_read" on storage.objects;
create policy "messenger_attachments_public_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'messenger-attachments'
    and exists (
      select 1 from public.tenant_members m
      where m.user_id::text = (storage.foldername(name))[1]
        and m.tenant_id = public.current_tenant_id()
    )
  );

create or replace function public.guard_messenger_file_path()
returns trigger
language plpgsql
as $$
begin
  if new.file_path is null or (tg_op = 'UPDATE' and new.file_path is not distinct from old.file_path) then
    return new;
  end if;
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if split_part(new.file_path, '/', 1) !~ '^[0-9a-fA-F-]{36}$'
     or not exists (
       select 1 from public.tenant_members m
       where m.user_id::text = lower(split_part(new.file_path, '/', 1))
         and m.tenant_id = public.current_tenant_id()
     ) then
    raise exception '첨부파일 경로가 올바르지 않습니다.';
  end if;
  return new;
end;
$$;
drop trigger if exists messenger_messages_guard_file_path on public.messenger_messages;
create trigger messenger_messages_guard_file_path
  before insert or update on public.messenger_messages
  for each row execute function public.guard_messenger_file_path();
