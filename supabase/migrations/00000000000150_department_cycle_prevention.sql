-- 부서 상위구조(parent_department_id)에 자기 자신을 직접 지정하는 것만
-- 막혀 있었고(departments_no_self_parent 체크 제약, migration 109),
-- 2단계 이상의 순환 참조(A의 상위를 B로 두고, 나중에 B의 상위를 다시
-- A로 지정하는 식)는 어디서도 막지 않았다 — 전체 감사에서 발견.
--
-- 이 상태로 조직도(org-chart.ts의 buildOrgTree)가 parent_department_id를
-- 따라 트리를 만들면 실제로 원형 참조를 가진 JS 객체 그래프가 만들어지고,
-- 그걸 재귀로 그리는 org-chart-approver-picker.tsx(결재선 설정 화면에서
-- 조직도로 결재자를 고르는 컴포넌트)가 무한 재귀에 빠져 그 화면이
-- 멈추거나 크래시할 수 있다.
--
-- 상위로 몇 단계를 거슬러 올라가도(재귀) 자기 자신이 다시 나오면 막는다 —
-- 클라이언트/서버 액션 쪽 검사를 우회해도(직접 API 호출 등) DB 트리거가
-- 최종 방어선이 된다.
create or replace function public.prevent_department_cycle()
returns trigger
language plpgsql
as $$
declare
  v_current uuid := new.parent_department_id;
  v_guard integer := 0;
begin
  while v_current is not null loop
    if v_current = new.id then
      raise exception '상위 부서를 순환 참조(원형 구조)로 지정할 수 없습니다.';
    end if;
    v_guard := v_guard + 1;
    if v_guard > 1000 then
      -- 이 시점까지 순환이 안 걸렸다면 정상 트리로 간주하고 더 이상 거슬러
      -- 올라가지 않는다(부서 수가 실제로 1000단계를 넘을 일은 없음).
      exit;
    end if;
    select parent_department_id into v_current from public.departments where id = v_current;
  end loop;
  return new;
end;
$$;

drop trigger if exists departments_prevent_cycle on public.departments;
create trigger departments_prevent_cycle
  before insert or update of parent_department_id on public.departments
  for each row
  execute function public.prevent_department_cycle();
