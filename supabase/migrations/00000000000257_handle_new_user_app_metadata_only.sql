-- 회원가입 trigger(handle_new_user)가 "어느 회사에 합류시킬지"를 누구나 조작할 수 있는 user_metadata 에서 읽던 문제(보안 점검 결과).
--
-- Supabase 공개 가입 API(/auth/v1/signup)는 로그인 없이, 공개 키만으로 user_metadata 를 마음대로 적어 보낼 수 있다.
-- 그러면 trigger 가 그 회사의 tenant_members/profiles(직원)를 만들어 줘서 다른 회사 데이터에 직원 권한으로 접근할 수 있었고,
-- portal_customer_id 를 넣으면 남의 거래처 포털 계정도 만들 수 있었다.
-- → 권한을 정하는 5개 값(tenant_id, new_tenant_name, new_tenant_slug, portal_customer_id, portal_subcontractor_id)은
--    service role 만 쓸 수 있는 app_metadata(raw_app_meta_data)에서만 읽는다. 표시용 full_name/username 은 user_metadata 그대로.
--    앱 코드는 이 값을 app_metadata 로도 보내도록 바꿨다(src/lib/auth-provisioning.ts).
-- 공개 가입으로 들어온 계정은 이 값이 없어 "tenant_id … 가 반드시 필요합니다" 오류로 거절된다(계정이 만들어지지 않는다).
-- 주의: 이 마이그레이션이 적용된 뒤에는 옛 코드(user_metadata 만 보내는)로는 계정을 만들 수 없다 — 코드 배포와 같은 시점에 적용된다.
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
  v_portal_customer_id := nullif(new.raw_app_meta_data ->> 'portal_customer_id', '')::uuid;

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

  v_portal_subcontractor_id := nullif(new.raw_app_meta_data ->> 'portal_subcontractor_id', '')::uuid;

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

  v_tenant_id := nullif(new.raw_app_meta_data ->> 'tenant_id', '')::uuid;
  v_new_tenant_name := nullif(new.raw_app_meta_data ->> 'new_tenant_name', '');
  v_new_tenant_slug := nullif(new.raw_app_meta_data ->> 'new_tenant_slug', '');

  if v_tenant_id is null and v_new_tenant_name is not null then
    insert into public.tenants (name, slug)
    values (v_new_tenant_name, v_new_tenant_slug)
    returning id into v_tenant_id;
    v_is_new_tenant := true;
  end if;

  if v_tenant_id is null then
    raise exception
      '계정 생성 시 app_metadata에 tenant_id(기존 테넌트 합류) 또는 new_tenant_name+new_tenant_slug(신규 테넌트 생성)가 반드시 필요합니다.';
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
