-- 홈택스 일괄발급 엑셀은 매번 조회 시점 기준으로 "세금계산서 레코드가
-- 있는 매출 건"을 전부 다시 긁어온다 — "우리 DB에 세금계산서를
-- 만들어뒀다"와 "실제로 홈택스에 업로드했다"가 서로 다른 상태인데 지금은
-- 구분이 없어서, 겹치는 기간으로 다시 export하면 이미 홈택스에 올린
-- 건이 또 포함돼 중복 업로드될 위험이 있다(사용자 지적). 업로드는
-- 홈택스 화면에서 사람이 직접 하는 일이라 자동으로는 알 수 없으니,
-- 사람이 "업로드 완료" 버튼을 눌러 표시하면 그 시각을 저장해두고
-- 이후 export 조회에서 기본적으로 제외한다.
alter table public.tax_invoices
  add column if not exists hometax_uploaded_at timestamptz;

-- tax_invoices_update_owner_or_admin 정책 때문에 본인이 등록한 매출 건의
-- 세금계산서만 UPDATE할 수 있는데, 홈택스 업로드는 보통 회계 담당자 한
-- 명이 여러 영업사원이 등록한 매출 건을 한꺼번에 묶어서 처리하는
-- 일이다 — RLS를 그대로 두면 본인 것 아닌 건은 조용히 0행 갱신되는
-- silent failure가 난다(work_order 자재투입과 같은 이유로 definer 함수로
-- 우회, issue_work_order_materials 주석 참고).
create or replace function public.mark_tax_invoices_hometax_uploaded(p_ids uuid[])
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  update public.tax_invoices
  set hometax_uploaded_at = now()
  where id = any(p_ids)
    and tenant_id = public.current_tenant_id()
    and hometax_uploaded_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_tax_invoices_hometax_uploaded(uuid[]) from public;
grant execute on function public.mark_tax_invoices_hometax_uploaded(uuid[]) to authenticated;
