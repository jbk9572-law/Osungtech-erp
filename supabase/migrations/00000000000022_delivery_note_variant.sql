-- 출고증(document_type = '출고증') 거래처 중 실제 업체별 출고증 서식이 별도로
-- 존재하는 곳을 위한 서식 선택 컬럼. null이면 기존 공용 출고증 서식을 그대로 쓴다.
alter table public.customers
  add column if not exists delivery_note_variant text
  check (delivery_note_variant in ('sns_pheeltech', 'zenith_tech', 'kt_solution'));
