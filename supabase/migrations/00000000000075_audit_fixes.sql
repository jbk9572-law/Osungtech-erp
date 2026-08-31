-- 전체 코드베이스 점검(9/2 병합 전 최종 감사)에서 발견된 기존 버그 2건 수정.

-- 1) apply_inventory_transaction()이 델타를 여전히 integer 지역변수에 담고
-- 있다 — migration 00000000000024에서 quantity 컬럼들을 전부 numeric으로
-- 바꿨는데(소수점 입력 지원, 예: 모조지 "3.2연") 이 트리거만 놓쳐서, 소수점
-- 수량이 들어올 때마다 정수로 반올림된 값이 재고에 반영되고 있었다.
create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  delta numeric;
  updated_rows integer;
begin
  delta := case
    when new.type = 'out' then -abs(new.quantity)
    else new.quantity
  end;

  update public.inventory
  set quantity = quantity + delta, updated_at = now()
  where product_id = new.product_id and warehouse_id = new.warehouse_id;

  get diagnostics updated_rows = row_count;

  if updated_rows = 0 then
    insert into public.inventory (product_id, warehouse_id, quantity, updated_at)
    values (new.product_id, new.warehouse_id, delta, now());
  end if;

  return new;
end;
$$;

-- 2) get_email_for_username()이 anon(로그인 전 익명 세션)에게도 실행 권한이
-- 있어서, 앱 화면을 거치지 않고 공개된 anon key만으로 REST API를 직접
-- 호출해 아이디 존재 여부/이메일을 무제한으로 조회(계정 목록 수집)할 수
-- 있었다. 로그인 폼(비로그인 상태)에서 이 조회가 여전히 필요하므로,
-- anon 직접 호출은 막고 서버(관리자 클라이언트, service_role)를 통해서만
-- 부르도록 좁힌다 — src/app/login/actions.ts가 이 함수를 admin 클라이언트로
-- 호출하도록 같이 수정했다.
revoke all on function public.get_email_for_username(text) from public, anon, authenticated;
grant execute on function public.get_email_for_username(text) to service_role;
