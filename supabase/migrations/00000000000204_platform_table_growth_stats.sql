-- 50개+ 테넌트로 늘어날 걸 대비한 "데이터 비대화 방지" 1단계 — 먼저
-- 어느 테이블이 얼마나 쌓이고 있는지 보이게 한다(사용자 요청). 실제로
-- 오래된 데이터를 지우거나 아카이빙하는 건 세금/회계 보관 의무가 있는
-- 매출/매입 전표까지 건드릴 위험이 있는 데이터 삭제 동작이라, 보관
-- 기간 정책을 사용자와 먼저 정한 뒤 다음 단계로 진행한다 — 이번엔
-- 플랫폼 관리자가 성장 추이를 볼 수 있게 하는 것까지만 한다.
--
-- 대상은 "거래 기록이 아니라 계속 누적되기만 하는 로그성 테이블"로
-- 좁힌다 — audit_logs(변경이력), location_stock_history(위치별 재고
-- 이력), messenger_messages(메신저), inventory_transactions(입출고
-- 전체, 조정뿐 아니라 매출/매입 연동분도 포함돼 가장 빨리 쌓인다).
-- 매출/매입 전표 자체(sales_orders 등)는 보관 의무가 있는 핵심
-- 데이터라 "비대화 방지" 대상이 아니라 제외한다.
create or replace function public.get_table_growth_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 조회할 수 있습니다.';
  end if;

  select jsonb_build_object(
    'tables', jsonb_build_array(
      jsonb_build_object(
        'key', 'audit_logs',
        'label', '변경 이력',
        'totalRows', (select count(*) from public.audit_logs),
        'last30d', (select count(*) from public.audit_logs where created_at > now() - interval '30 days')
      ),
      jsonb_build_object(
        'key', 'inventory_transactions',
        'label', '재고 입출고',
        'totalRows', (select count(*) from public.inventory_transactions),
        'last30d', (select count(*) from public.inventory_transactions where created_at > now() - interval '30 days')
      ),
      jsonb_build_object(
        'key', 'location_stock_history',
        'label', '위치별 재고 이력',
        'totalRows', (select count(*) from public.location_stock_history),
        'last30d', (select count(*) from public.location_stock_history where created_at > now() - interval '30 days')
      ),
      jsonb_build_object(
        'key', 'messenger_messages',
        'label', '메신저 메시지',
        'totalRows', (select count(*) from public.messenger_messages),
        'last30d', (select count(*) from public.messenger_messages where created_at > now() - interval '30 days')
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_table_growth_stats() from public;
grant execute on function public.get_table_growth_stats() to authenticated;
