-- 거래처/공급처 단가(customer_product_prices, supplier_product_prices)는
-- "최신 단가 하나만 유지"하는 구조라 과거 단가가 얼마였는지 알 방법이
-- 없었다(사용자 요청 — "단가예약에서 단가변경 히스토리도 좀 같이볼수있나").
-- 이미 매출/매입/품목/거래처 등에 붙어 있는 범용 감사 로그 트리거
-- (record_audit_log(), migration 074)를 단가 테이블 2개에도 그대로
-- 적용한다 — 새 이력 테이블을 따로 만들지 않고 기존 audit_logs를 재사용.
drop trigger if exists audit_customer_product_prices on public.customer_product_prices;
create trigger audit_customer_product_prices
  after insert or update or delete on public.customer_product_prices
  for each row execute procedure public.record_audit_log();

drop trigger if exists audit_supplier_product_prices on public.supplier_product_prices;
create trigger audit_supplier_product_prices
  after insert or update or delete on public.supplier_product_prices
  for each row execute procedure public.record_audit_log();

-- audit_logs 자체는 관리자만 조회 가능(audit_logs_select_admin)해서,
-- 매출/매입 담당 직원이 평소 쓰는 거래처/공급처 상세 화면에서는 이
-- 트리거만으로 단가 이력을 볼 수 없다. 전체 감사 로그를 여는 대신,
-- "이 단가 행 하나"의 이력만 좁게 돌려주는 security definer 함수로
-- 안전하게 우회한다 — 테넌트 경계는 함수 안에서 직접 확인한다(RLS를
-- 타지 않으므로).
create or replace function public.get_price_change_history(p_table_name text, p_record_id uuid)
returns table (
  id uuid,
  action text,
  old_unit numeric,
  new_unit numeric,
  actor_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_table_name not in ('customer_product_prices', 'supplier_product_prices') then
    raise exception 'invalid table_name: %', p_table_name;
  end if;

  return query
  select
    al.id,
    al.action,
    case
      when p_table_name = 'customer_product_prices' then (al.old_data ->> 'unit_price')::numeric
      else (al.old_data ->> 'unit_cost')::numeric
    end as old_unit,
    case
      when p_table_name = 'customer_product_prices' then (al.new_data ->> 'unit_price')::numeric
      else (al.new_data ->> 'unit_cost')::numeric
    end as new_unit,
    p.full_name as actor_name,
    al.created_at
  from public.audit_logs al
  left join public.profiles p on p.id = al.actor
  where al.table_name = p_table_name
    and al.record_id = p_record_id
    and al.tenant_id = public.current_tenant_id()
  order by al.created_at desc
  limit 50;
end;
$$;

revoke all on function public.get_price_change_history(text, uuid) from public;
grant execute on function public.get_price_change_history(text, uuid) to authenticated;
