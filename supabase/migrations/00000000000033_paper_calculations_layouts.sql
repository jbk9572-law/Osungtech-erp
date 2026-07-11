-- 저장된 모조지 계산에 배치 도면(NEST LAYOUT) 원본까지 같이 남겨서, 나중에
-- 숫자 요약뿐 아니라 실제 재단 배치도를 다시 열어볼 수 있게 한다.
alter table public.paper_calculations
  add column if not exists layouts jsonb not null default '[]'::jsonb;
