-- 회사(테넌트)별 사용 가능한 인쇄 서식(명세표) — 플랫폼 관리자가 정한다.
-- N=엘보닉스 A형, NB=엘보닉스 B형, B=엔택스 B형, A=엔택스 A형.
-- NULL이면 "미지정" — 코드의 기존 규칙(테마·회사 식별자)을 그대로 따른다. 그래서 이 마이그레이션을 적용해도 기존 회사 화면은 바뀌지 않는다.
alter table public.tenants
  add column if not exists allowed_invoice_forms text[];

alter table public.tenants
  drop constraint if exists tenants_allowed_invoice_forms_check;

alter table public.tenants
  add constraint tenants_allowed_invoice_forms_check check (
    allowed_invoice_forms is null
    or (cardinality(allowed_invoice_forms) >= 1 and allowed_invoice_forms <@ array['N', 'NB', 'B', 'A']::text[])
  );

create or replace function public.set_tenant_invoice_forms(p_tenant_id uuid, p_forms text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 변경할 수 있습니다.';
  end if;
  -- NULL을 넘기면 "미지정"(기존 규칙)으로 되돌린다
  if p_forms is not null and (cardinality(p_forms) < 1 or not (p_forms <@ array['N', 'NB', 'B', 'A']::text[])) then
    raise exception '알 수 없는 인쇄 서식이 들어 있습니다.';
  end if;
  update public.tenants set allowed_invoice_forms = p_forms where id = p_tenant_id;
end;
$$;

revoke all on function public.set_tenant_invoice_forms(uuid, text[]) from public;
grant execute on function public.set_tenant_invoice_forms(uuid, text[]) to authenticated;

-- 플랫폼 관리자 환경설정 화면이 회사별 지정값을 읽는다(get_platform_tenant_list는 건드리지 않는다).
create or replace function public.get_platform_tenant_invoice_forms()
returns table (tenant_id uuid, allowed_invoice_forms text[])
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 볼 수 있습니다.';
  end if;
  return query select t.id, t.allowed_invoice_forms from public.tenants t;
end;
$$;

revoke all on function public.get_platform_tenant_invoice_forms() from public;
grant execute on function public.get_platform_tenant_invoice_forms() to authenticated;
