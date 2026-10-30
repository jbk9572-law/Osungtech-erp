-- 감사 로그를 "업무처리(트랜잭션) 단위"로 묶어서 볼 수 있게 한다
-- (사용자 요청 — "업무처리 단위로 묶어서 되돌리기" 아이디어의 1단계:
-- 먼저 묶어서 보여주기. 실제로 되돌리는(restore) 동작은 데이터를 직접
-- 고치는 위험한 기능이라 별도 확인 후 다음 단계로 진행한다).
--
-- 같은 Postgres 트랜잭션 안에서 일어난 여러 테이블 변경은 이미
-- txid_current()가 같은 값을 돌려준다 — 예를 들어 delete_sale_with_items()
-- RPC 하나가 매출 전표를 지우면서 동시에 재고를 되돌리는 것처럼, 하나의
-- "업무처리"가 여러 테이블에 걸쳐 원자적으로 실행되는 경우 그 결과로
-- 남는 audit_logs 행들은 자연히 같은 트랜잭션 번호를 공유한다. 새로
-- 애플리케이션 코드에서 그룹 ID를 만들어 넘길 필요 없이, 트리거에서
-- 그 값을 그대로 기록하기만 하면 된다.
--
-- 주의(한계): 하나의 사용자 동작이 서버 액션에서 RPC 호출 + 별도의
-- 후속 호출(예: reverseOrderLocationStock)로 나뉘어 있으면, 그 후속
-- 호출은 다른 트랜잭션이라 tx_id가 갈린다 — "DB 함수 하나로 묶인
-- 범위"만 정확히 그룹핑된다. 기존 데이터는 tx_id가 없어 그룹핑 대상이
-- 아니다(NULL로 둔다 — 과거 트랜잭션 번호를 복원할 방법이 없다).
alter table public.audit_logs add column if not exists tx_id bigint;
create index if not exists audit_logs_tenant_tx_idx on public.audit_logs (tenant_id, tx_id);

create or replace function public.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_logs (table_name, record_id, action, actor, new_data, is_demo, tenant_id, tx_id)
    values (
      tg_table_name, new.id, 'insert', auth.uid(), to_jsonb(new),
      coalesce((to_jsonb(new) ->> 'is_demo')::boolean, false),
      nullif(to_jsonb(new) ->> 'tenant_id', '')::uuid,
      txid_current()
    );
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_logs (table_name, record_id, action, actor, old_data, new_data, is_demo, tenant_id, tx_id)
    values (
      tg_table_name, new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new),
      coalesce((to_jsonb(new) ->> 'is_demo')::boolean, false),
      nullif(to_jsonb(new) ->> 'tenant_id', '')::uuid,
      txid_current()
    );
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_logs (table_name, record_id, action, actor, old_data, is_demo, tenant_id, tx_id)
    values (
      tg_table_name, old.id, 'delete', auth.uid(), to_jsonb(old),
      coalesce((to_jsonb(old) ->> 'is_demo')::boolean, false),
      nullif(to_jsonb(old) ->> 'tenant_id', '')::uuid,
      txid_current()
    );
    return old;
  end if;
  return null;
end;
$$;
