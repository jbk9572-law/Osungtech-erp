-- document_templates(migration 107)는 처음부터 의도적으로 빈 상태로
-- 시작했다 — 근로계약서처럼 고용노동부가 정확한 문구를 고시하는 법정
-- 서식을 여기서 지어내 "공식 양식"인 것처럼 심어두면 그 자체가 리스크라
-- 관리자가 공식 서식을 직접 붙여넣어 등록하게 비워뒀다(107의 주석 참고).
--
-- 다만 재직증명서류처럼 정해진 법정 문구가 없고(회사마다 표현이 달라도
-- 무방한, 관행적으로 통용되는 구조일 뿐) 실무에서 바로 쓰는 기초 양식
-- 몇 개까지 하나도 없이 시작하는 건 "양식 관리에서 먼저 등록해주세요"
-- 안내문만 보여주는 빈 화면이라 실사용성이 없다는 지적이 있었다. 그래서
-- 법정 문구 리스크가 없는 4종만 기본 제공하고(근로계약서 등은 여전히
-- 비워둔다), 새 테넌트가 생길 때(handle_new_user, 124)도 같이 채워준다.
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
begin
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

-- 위 트리거 함수와 아래 기존 테넌트 백필이 똑같은 4종 목록을 복붙해
-- 들고 있으면 나중에 하나만 고치고 잊어버리기 쉬우니, 목록 자체를
-- 함수 하나로 뽑아 공유한다.
create or replace function public.default_document_templates()
returns table (category text, name text, body text)
language sql
immutable
as $$
  select * from (values
    ('hr_certificate', '재직증명서', $tmpl$재 직 증 명 서

성        명 : {{employee_name}}
소        속 : {{department_name}}
직        위 : {{position_title}}
입   사   일 : {{hire_date}}

위 사람은 현재 본 회사에 재직하고 있음을 증명합니다.

용        도 : {{purpose}}
제  출  처 : {{submit_to}}

{{today}}

회   사   명 : {{company_name}}
대   표   자 : {{representative_name}}   (인)$tmpl$),
    ('hr_certificate', '경력증명서', $tmpl$경 력 증 명 서

성        명 : {{employee_name}}
소        속 : {{department_name}}
직        위 : {{position_title}}

재 직 기 간 : {{hire_date}} ~ {{leave_date}}
담 당 업 무 : {{job_description}}

위 사람은 위 기간 동안 본 회사에 재직하며 상기 업무를 담당하였음을 증명합니다.

용        도 : {{purpose}}

{{today}}

회   사   명 : {{company_name}}
대   표   자 : {{representative_name}}   (인)$tmpl$),
    ('hr_certificate', '재직 및 급여증명서', $tmpl$재직 및 급여증명서

성        명 : {{employee_name}}
소        속 : {{department_name}}
직        위 : {{position_title}}
입   사   일 : {{hire_date}}

월 평균 급여(세전) : {{monthly_salary}} 원

위 사람은 현재 본 회사에 재직 중이며, 위 급여를 지급받고 있음을 증명합니다.

용        도 : {{purpose}}

{{today}}

회   사   명 : {{company_name}}
대   표   자 : {{representative_name}}   (인)$tmpl$),
    ('general', '사직서', $tmpl$사  직  서

소        속 : {{department_name}}
직        위 : {{position_title}}
성        명 : {{employee_name}}

사직 예정일 : {{resignation_date}}
사        유 : {{reason}}

위 본인은 위와 같은 사유로 사직하고자 하오니 허가하여 주시기 바랍니다.

{{today}}

신 청 인 : {{employee_name}}   (인)

{{company_name}} 귀중$tmpl$)
  ) as t(category, name, body)
$$;

-- 이미 만들어진 기존 테넌트는 위 트리거가 적용되지 않으므로, 아직 양식이
-- 하나도 없는 테넌트에 한해 같은 4종을 채워준다. 이미 뭔가 등록해둔
-- 테넌트(직접 만든 것이든 이전에 이 마이그레이션이 이미 실행된 것이든)는
-- 건드리지 않는다.
insert into public.document_templates (tenant_id, category, name, body)
select t.id, d.category, d.name, d.body
from public.tenants t
cross join public.default_document_templates() d
where not exists (
  select 1 from public.document_templates dt where dt.tenant_id = t.id and dt.is_demo = false
);
