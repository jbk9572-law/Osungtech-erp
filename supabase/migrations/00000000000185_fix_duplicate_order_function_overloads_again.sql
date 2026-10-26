-- migration 67에서 한 번 정리했던 문제("create or replace function으로
-- 매개변수를 끝에 추가하면 같은 함수로 보이지만, PostgreSQL은 매개변수
-- 타입 목록이 다르면 별도의 오버로드로 취급한다")가 그 뒤로도 계속
-- 반복됐다 — 71(반품)/72(반품사유)/73(이월)/174(과세구분·증빙유형)/
-- 180(샘플)이 전부 옛 시그니처를 먼저 지우지 않고 새 매개변수를 끝에
-- 붙인 "create or replace"만 실행해서, 같은 함수 이름에 여러 세대의
-- 시그니처가 계속 쌓였다. PostgREST는 이런 "접두사 관계인 오버로드"가
-- 여럿 있으면 요청 JSON에 없는 매개변수가 있을 때 어느 버전을 불러야
-- 할지 못 정하고 "Could not choose the best candidate function" 오류를
-- 낸다 — 실제로 Dev seed 크론(매일 자동으로 더미 매출/매입을 넣는
-- GitHub Actions 잡)이 00000000000174가 머지된 이후로 매출/매입 둘 다
-- 이 오류로 계속 0건씩 실패하고 있었다(사용자가 "8일 이후로 더미데이터가
-- 끊겼다"고 지적해 발견). 지금 이 글을 쓰는 코드(actions.ts 등 실제
-- 앱의 호출부)는 항상 "최신" 시그니처 전체를 다 채워서 보내므로
-- 겉으로는 멀쩡해 보이지만, 매개변수를 일부만 보내는 모든 호출부
-- (이번 더미데이터 스크립트처럼)에서 똑같이 재발할 수 있는 잠재
-- 버그였다.
--
-- migration 67과 같은 방식 — 지금 남아있어야 하는 최신 시그니처만
-- 남기고, 그 사이에 쌓인 모든 중간 세대의 시그니처를 명시적으로
-- 지운다. 앞으로 또 이 함수들을 확장할 때는 반드시 옛 시그니처를
-- 먼저 drop function으로 지운 뒤에 create or replace해야 한다
-- (migration 84/87처럼) — 그냥 매개변수만 추가하는 create or replace는
-- "교체"가 아니라 "새 오버로드 추가"라는 점을 다시 기록해둔다.

-- create_sale_with_items: 66(9개)→71(+is_return)→72(+return_reason)→
-- 73/87/149(+is_carryover, 동일 시그니처 재사용)→174(+tax_type,
-- evidence_type)→180(+is_sample, 현재 최신 15개) — 180 버전만 남긴다.
drop function if exists public.create_sale_with_items(
  uuid, uuid, date, text, uuid, jsonb, text, text, bigint
);
drop function if exists public.create_sale_with_items(
  uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean
);
drop function if exists public.create_sale_with_items(
  uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean, text
);
drop function if exists public.create_sale_with_items(
  uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean, text, boolean
);
drop function if exists public.create_sale_with_items(
  uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean, text, boolean, text, text
);

-- create_purchase_with_items: 66(9개)→73/87(+is_carryover, 10개)→
-- 174(+tax_type, evidence_type, 현재 최신 12개) — 174 버전만 남긴다.
drop function if exists public.create_purchase_with_items(
  uuid, uuid, date, text, uuid, jsonb, text, text, bigint
);
drop function if exists public.create_purchase_with_items(
  uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean
);

-- update_sale_with_items: 66(10개)→71(+is_return)→72(+return_reason)→
-- 73/87/149(+is_carryover, 동일 시그니처 재사용)→174(+tax_type,
-- evidence_type)→180(+is_sample, 현재 최신 16개) — 180 버전만 남긴다.
drop function if exists public.update_sale_with_items(
  uuid, uuid, uuid, date, text, uuid, jsonb, text, text, bigint
);
drop function if exists public.update_sale_with_items(
  uuid, uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean
);
drop function if exists public.update_sale_with_items(
  uuid, uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean, text
);
drop function if exists public.update_sale_with_items(
  uuid, uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean, text, boolean
);
drop function if exists public.update_sale_with_items(
  uuid, uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean, text, boolean, text, text
);

-- update_purchase_with_items: 66(10개)→73/87(+is_carryover, 11개, 87은
-- 11개짜리를 drop 후 재생성했지만 66의 10개짜리는 그대로 남아있었음)→
-- 174(+tax_type, evidence_type, 현재 최신 13개) — 174 버전만 남긴다.
drop function if exists public.update_purchase_with_items(
  uuid, uuid, uuid, date, text, uuid, jsonb, text, text, bigint
);
drop function if exists public.update_purchase_with_items(
  uuid, uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean
);

-- create_purchase_and_sale_with_items: 66/68/69(14개, migration 84가
-- 이미 지움)→84/149(+sale_delivery_method, 15개)→174(+tax_type,
-- evidence_type, 현재 최신 17개) — 15개짜리만 남아있으므로 그것만
-- 지운다.
drop function if exists public.create_purchase_and_sale_with_items(
  uuid, uuid, uuid, date, date, text, text, uuid, jsonb, jsonb, text, text, bigint, bigint, text
);
