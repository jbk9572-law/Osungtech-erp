-- 266: 재고가 모자라면 출고·차감을 막는다(음수 재고 금지). 일부 업종(입고 전 판매, 직송)은 음수 재고가 필요할 수 있어
--      회사별 스위치(tenants.allow_negative_stock, 기본 false=금지)를 둔다. 켜기/끄기는 플랫폼 운영자만(서비스 키·SQL) 바꿀 수 있다
--      — 회사 관리자 본인은 tenants 를 직접 고칠 수 없다(254).
alter table public.tenants add column if not exists allow_negative_stock boolean not null default false;

create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  delta numeric;
  v_new_qty numeric;
  v_name text;
  v_allow boolean;
  v_sandbox boolean;
begin
  delta := case
    when new.type = 'out' then -abs(new.quantity)
    else new.quantity
  end;

  update public.inventory
  set quantity = quantity + delta, updated_at = now()
  where product_id = new.product_id
    and warehouse_id = new.warehouse_id
    and is_demo = new.is_demo
    and tenant_id = new.tenant_id
  returning quantity into v_new_qty;

  if not found then
    insert into public.inventory (product_id, warehouse_id, quantity, is_demo, tenant_id, updated_at)
    values (new.product_id, new.warehouse_id, delta, new.is_demo, new.tenant_id, now())
    returning quantity into v_new_qty;
  end if;

  if delta < 0 and v_new_qty < 0 then
    select coalesce(allow_negative_stock, false), coalesce(is_sandbox, false) into v_allow, v_sandbox
    from public.tenants where id = new.tenant_id;
    -- 샌드박스 더미 데이터 생성 함수는 일부러 재고 부족 같은 경계 상황을 만든다 — 그 함수 안(app.seed_mode)에서만 샌드박스 회사에 한해 허용.
    if v_sandbox and current_setting('app.seed_mode', true) = 'on' then
      v_allow := true;
    end if;
    if not coalesce(v_allow, false) then
      select name into v_name from public.products where id = new.product_id;
      raise exception '"%" 재고가 부족합니다. (이 창고 현재 %, 차감 %)',
        coalesce(v_name, '품목'), v_new_qty - delta, -delta;
    end if;
  end if;

  return new;
end;
$$;

-- 더미 데이터 생성 함수 실행 중에만 켜지는 설정(함수 단위 설정이라 호출이 끝나면 자동으로 풀린다).
alter function public.sandbox_seed_stage(int) set app.seed_mode = 'on';
alter function public.sandbox_seed() set app.seed_mode = 'on';
alter function public.sandbox_seed_industry(text) set app.seed_mode = 'on';
