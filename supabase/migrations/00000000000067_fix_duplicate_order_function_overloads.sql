-- 00000000000061/64/66에서 "create or replace function으로 매개변수를 끝에
-- 기본값과 함께 추가하면 시그니처를 유지한 채 진짜 교체된다"고 가정했는데,
-- 이건 틀렸다 — PostgreSQL은 매개변수 "타입 목록"이 다르면(개수가 늘어도)
-- 같은 함수로 보지 않고 별도의 오버로드를 새로 만든다. 그 결과
-- create_sale_with_items/create_purchase_with_items/update_sale_with_items/
-- update_purchase_with_items/create_purchase_and_sale_with_items 전부
-- payment_method → delivery_method → doc_no 마이그레이션을 거치며 옛
-- 버전이 지워지지 않고 계속 쌓여있었다. PostgREST는 이렇게 이름이 같고
-- 매개변수 목록이 "접두사" 관계인 오버로드가 여러 개 있으면, 요청 JSON에
-- 없는 매개변수가 있을 때 어느 버전을 불러야 할지 못 정하고
-- "Could not choose the best candidate function" 오류를 낸다(매입+매출
-- 동시등록에서 실제로 발생) — 앞으로 같은 함수를 다시 확장할 때도 매개변수
-- 하나만 덜 보내면 언제든 재발할 수 있는 문제였다.
--
-- 지금 남아있어야 하는 최신 시그니처(00000000000066)만 남기고, 그 이전
-- 세대의 시그니처는 전부 명시적으로 지운다.

drop function if exists public.create_sale_with_items(uuid, uuid, date, text, uuid, jsonb);
drop function if exists public.create_sale_with_items(uuid, uuid, date, text, uuid, jsonb, text);
drop function if exists public.create_sale_with_items(uuid, uuid, date, text, uuid, jsonb, text, text);

drop function if exists public.create_purchase_with_items(uuid, uuid, date, text, uuid, jsonb);
drop function if exists public.create_purchase_with_items(uuid, uuid, date, text, uuid, jsonb, text);
drop function if exists public.create_purchase_with_items(uuid, uuid, date, text, uuid, jsonb, text, text);

drop function if exists public.update_sale_with_items(uuid, uuid, uuid, date, text, uuid, jsonb);
drop function if exists public.update_sale_with_items(uuid, uuid, uuid, date, text, uuid, jsonb, text);
drop function if exists public.update_sale_with_items(uuid, uuid, uuid, date, text, uuid, jsonb, text, text);

drop function if exists public.update_purchase_with_items(uuid, uuid, uuid, date, text, uuid, jsonb);
drop function if exists public.update_purchase_with_items(uuid, uuid, uuid, date, text, uuid, jsonb, text);
drop function if exists public.update_purchase_with_items(uuid, uuid, uuid, date, text, uuid, jsonb, text, text);

drop function if exists public.create_purchase_and_sale_with_items(
  uuid, uuid, uuid, date, date, text, text, uuid, jsonb, jsonb
);
drop function if exists public.create_purchase_and_sale_with_items(
  uuid, uuid, uuid, date, date, text, text, uuid, jsonb, jsonb, text
);
drop function if exists public.create_purchase_and_sale_with_items(
  uuid, uuid, uuid, date, date, text, text, uuid, jsonb, jsonb, text, text
);
