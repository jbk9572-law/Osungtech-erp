-- QR 라벨 인쇄 화면에서 매번 다시 고르던 위/아래 방향을 품목에 저장해
-- 새로고침해도 유지되게 한다. 기본값은 '위'이고, 카테고리가 Filter인
-- 품목만 '아래'를 기본값으로 backfill 한다(실제 랙 배치 관행에 맞춤).
alter table public.products
  add column if not exists label_direction text not null default 'up'
    check (label_direction in ('up', 'down'));

update public.products p
set label_direction = 'down'
from public.categories c
where p.category_id = c.id
  and c.name = 'Filter'
  and p.label_direction = 'up';
