-- 260: 직원이 REST로 직접 꽂아 넣을 수 있던 위조 구멍 + 감사에서 나온 권한 구멍.
--  1) 연차/근태정정 신청을 status='approved'로 직접 insert → 결재 없이 승인 상태로 위조
--  2) 근태기록을 과거 날짜·임의 시각으로 직접 insert/update → 출퇴근 위조
--  3) 인사문서를 status='issued'로 직접 insert, 발급 후 수정/삭제
--  4) consume_subcontractor_material_for_step: 호출자·회사 검증 없는 definer 함수가 전체 공개
--  5) create_dm_channel / create_group_channel: 다른 회사 사용자를 멤버로 추가 가능
--  6) increment_tenant_file_usage: 임의의 큰 음수로 용량 집계를 0으로 만들 수 있음

-- 1) 신청은 항상 대기 상태로만 만들 수 있다(승인/반려는 결재 완료 트리거(definer)나 관리자만).
drop policy if exists "leave_requests_insert_own" on public.leave_requests;
create policy "leave_requests_insert_own" on public.leave_requests
  for insert with check (
    user_id = auth.uid() and status = 'pending' and decided_at is null and decided_by is null
  );

drop policy if exists "attendance_correction_requests_insert_own" on public.attendance_correction_requests;
create policy "attendance_correction_requests_insert_own" on public.attendance_correction_requests
  for insert with check (
    user_id = auth.uid() and status = 'pending' and decided_at is null and decided_by is null
  );

-- 2) 근태기록 가드: 일반 직원(REST 직접 호출)은 "지금" 찍는 출퇴근만 가능.
--    definer 함수(정정 승인 트리거)·관리자·데모 계정은 통과.
create or replace function public.guard_attendance_record_write()
returns trigger
language plpgsql
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_slack interval := interval '10 minutes';
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_admin() or public.is_demo_actor() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.work_date < v_today - 1 or new.work_date > v_today then
      raise exception '출퇴근은 오늘 날짜로만 기록할 수 있습니다. 지난 날짜는 근태 정정 신청을 이용해주세요.';
    end if;
    if new.clock_in_at is not null and abs(extract(epoch from (new.clock_in_at - now()))) > extract(epoch from v_slack) then
      raise exception '출근 시각은 현재 시각으로만 기록할 수 있습니다.';
    end if;
    if new.clock_out_at is not null and abs(extract(epoch from (new.clock_out_at - now()))) > extract(epoch from v_slack) then
      raise exception '퇴근 시각은 현재 시각으로만 기록할 수 있습니다.';
    end if;
  else
    if new.user_id is distinct from old.user_id or new.work_date is distinct from old.work_date then
      raise exception '근태 기록의 직원·날짜는 바꿀 수 없습니다.';
    end if;
    if new.clock_in_at is distinct from old.clock_in_at then
      if old.clock_in_at is not null
         or new.clock_in_at is null
         or abs(extract(epoch from (new.clock_in_at - now()))) > extract(epoch from v_slack) then
        raise exception '출근 시각은 한 번만, 현재 시각으로만 기록할 수 있습니다. 수정은 근태 정정 신청을 이용해주세요.';
      end if;
    end if;
    if new.clock_out_at is distinct from old.clock_out_at then
      if new.clock_out_at is null
         or abs(extract(epoch from (new.clock_out_at - now()))) > extract(epoch from v_slack) then
        raise exception '퇴근 시각은 현재 시각으로만 기록할 수 있습니다. 수정은 근태 정정 신청을 이용해주세요.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_records_guard_write on public.attendance_records;
create trigger attendance_records_guard_write
  before insert or update on public.attendance_records
  for each row execute function public.guard_attendance_record_write();

-- 3) 인사문서: 직원은 초안(draft)으로만 만들 수 있고, 발급된 문서는 관리자만 고치거나 지울 수 있다.
drop policy if exists "document_instances_insert" on public.document_instances;
create policy "document_instances_insert" on public.document_instances
  for insert with check (
    auth.role() = 'authenticated'
    and (public.is_admin() or (status = 'draft' and issued_at is null and created_by = auth.uid()))
    and (subject_user_id is null or exists (
      select 1 from public.tenant_members m
      where m.user_id = subject_user_id and m.tenant_id = public.current_tenant_id()
    ))
  );
drop policy if exists "document_instances_update_own" on public.document_instances;
create policy "document_instances_update_own" on public.document_instances
  for update using (public.is_admin() or (created_by = auth.uid() and status = 'draft'));
drop policy if exists "document_instances_delete_own" on public.document_instances;
create policy "document_instances_delete_own" on public.document_instances
  for delete using (public.is_admin() or (created_by = auth.uid() and status = 'draft'));

-- 4) definer 내부 전용 함수는 직접 호출 권한 회수(subcontractor_update_step_status가 definer라 계속 호출 가능).
revoke execute on function public.consume_subcontractor_material_for_step(uuid) from public, anon, authenticated;

-- 5) 메신저: 멤버는 같은 회사 직원이어야 한다.
create or replace function public.create_dm_channel(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_tenant_id uuid := public.current_tenant_id();
  v_is_demo boolean := public.is_demo_actor();
  v_self uuid := auth.uid();
begin
  if p_other_user_id = v_self then
    raise exception '자기 자신과는 DM을 만들 수 없습니다.';
  end if;
  if not exists (select 1 from public.tenant_members m where m.user_id = p_other_user_id and m.tenant_id = v_tenant_id) then
    raise exception '우리 회사 직원과만 대화할 수 있습니다.';
  end if;

  select c.id into v_channel_id
  from public.messenger_channels c
  where c.tenant_id = v_tenant_id and c.is_demo = v_is_demo and c.type = 'dm'
    and exists (select 1 from public.messenger_channel_members m where m.channel_id = c.id and m.user_id = v_self)
    and exists (select 1 from public.messenger_channel_members m where m.channel_id = c.id and m.user_id = p_other_user_id)
    and (select count(*) from public.messenger_channel_members m where m.channel_id = c.id) = 2
  limit 1;

  if v_channel_id is not null then
    return v_channel_id;
  end if;

  insert into public.messenger_channels (tenant_id, is_demo, type, name, created_by)
  values (v_tenant_id, v_is_demo, 'dm', null, v_self)
  returning id into v_channel_id;

  insert into public.messenger_channel_members (channel_id, user_id, tenant_id, is_demo)
  values
    (v_channel_id, v_self, v_tenant_id, v_is_demo),
    (v_channel_id, p_other_user_id, v_tenant_id, v_is_demo);

  return v_channel_id;
end;
$$;

create or replace function public.create_group_channel(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_tenant_id uuid := public.current_tenant_id();
  v_is_demo boolean := public.is_demo_actor();
  v_self uuid := auth.uid();
  v_member_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception '그룹 이름을 입력해주세요.';
  end if;
  if p_member_ids is not null and exists (
    select 1 from unnest(p_member_ids) as x(id)
    where not exists (select 1 from public.tenant_members m where m.user_id = x.id and m.tenant_id = v_tenant_id)
  ) then
    raise exception '우리 회사 직원만 그룹에 초대할 수 있습니다.';
  end if;

  insert into public.messenger_channels (tenant_id, is_demo, type, name, created_by)
  values (v_tenant_id, v_is_demo, 'group', trim(p_name), v_self)
  returning id into v_channel_id;

  insert into public.messenger_channel_members (channel_id, user_id, tenant_id, is_demo)
  values (v_channel_id, v_self, v_tenant_id, v_is_demo);

  foreach v_member_id in array coalesce(p_member_ids, '{}') loop
    if v_member_id <> v_self then
      insert into public.messenger_channel_members (channel_id, user_id, tenant_id, is_demo)
      values (v_channel_id, v_member_id, v_tenant_id, v_is_demo)
      on conflict do nothing;
    end if;
  end loop;

  return v_channel_id;
end;
$$;

revoke all on function public.create_dm_channel(uuid) from public;
grant execute on function public.create_dm_channel(uuid) to authenticated;
revoke all on function public.create_group_channel(text, uuid[]) from public;
grant execute on function public.create_group_channel(text, uuid[]) to authenticated;

-- 6) 파일 용량 집계: 한 번에 ±512MB 초과 변경은 거부(정상 업로드는 이보다 훨씬 작다).
create or replace function public.increment_tenant_file_usage(p_delta_bytes bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_new_bytes bigint;
begin
  if v_tenant_id is null then
    raise exception '소속 테넌트를 확인할 수 없습니다.';
  end if;
  if p_delta_bytes is null or abs(p_delta_bytes) > 536870912 then
    raise exception '비정상적인 파일 용량 변경 값입니다.';
  end if;

  if public.is_demo_actor() then
    select coalesce(file_bytes_used, 0) into v_new_bytes
    from public.tenant_usage where tenant_id = v_tenant_id;
    return coalesce(v_new_bytes, 0);
  end if;

  insert into public.tenant_usage (tenant_id, file_bytes_used, updated_at)
  values (v_tenant_id, greatest(0, p_delta_bytes), now())
  on conflict (tenant_id) do update
    set file_bytes_used = greatest(0, public.tenant_usage.file_bytes_used + p_delta_bytes),
        updated_at = now()
  returning file_bytes_used into v_new_bytes;

  return v_new_bytes;
end;
$$;
