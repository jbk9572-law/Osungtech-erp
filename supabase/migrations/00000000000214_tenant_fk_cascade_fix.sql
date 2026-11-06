-- 테넌트 삭제(delete_tenant_hard)가 "update or delete on table tenants
-- violates foreign key constraint audit_logs_tenant_id_fkey on table
-- audit_logs"로 실패했다(실제 사용자 보고, 스크린샷 확인). delete_tenant_hard()는
-- migration 211 주석에서 "tenant_id를 가진 테이블은 전부 references
-- tenants(id) on delete cascade로 걸려 있다(migration 99부터 일관된
-- 컨벤션)"는 전제로 설계됐는데, 실제로는 그렇지 않았다 — migration 99의
-- 32개 테이블 반복문(categories/customers/suppliers/products/... )과
-- inventory/audit_logs/profiles/company_profile, 그리고 이후 여러
-- 마이그레이션(102/105/106/107/109/111/112/116/158/161/165/167/168/176/177
-- 등)에서 추가된 tenant_id 컬럼들이 전부 on delete cascade 없이
-- 생성됐다. audit_logs 하나만 고치면 다음 삭제 시도에서 또 다른 테이블의
-- 같은 에러를 만나는 두더지잡기이므로(버그 수정 규칙 1번: 같은 패턴을
-- 찾으면 전부 한 번에 고친다), 하드코딩된 테이블 목록에 의존하지 않고
-- pg_constraint를 직접 조회해서 public.tenants(id)를 참조하는 모든 FK 중
-- on delete cascade가 아닌 것을 전부 찾아 한 번에 교체한다
-- (sandbox_reset()의 information_schema 동적 조회와 같은 접근 — 새 테이블이
-- 추가돼도 이 패턴을 또 손으로 찾을 필요가 없다).
do $$
declare
  r record;
  v_col text;
begin
  for r in
    select
      c.oid as con_oid,
      c.conrelid,
      c.conrelid::regclass::text as table_name,
      c.conname as constraint_name,
      c.conkey
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = 'public.tenants'::regclass
      and c.confdeltype <> 'c'
  loop
    if array_length(r.conkey, 1) <> 1 then
      raise exception 'tenants를 참조하는 복합키 FK 발견: %(%) — 자동 수정 대상에서 제외, 수동 확인이 필요합니다.', r.table_name, r.constraint_name;
    end if;

    select attname into v_col
    from pg_attribute
    where attrelid = r.conrelid and attnum = r.conkey[1];

    raise notice '% 테이블의 % 제약을 on delete cascade로 교체 (컬럼: %)', r.table_name, r.constraint_name, v_col;

    execute format('alter table %s drop constraint %I', r.table_name, r.constraint_name);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references public.tenants (id) on delete cascade',
      r.table_name, r.constraint_name, v_col
    );
  end loop;
end $$;
