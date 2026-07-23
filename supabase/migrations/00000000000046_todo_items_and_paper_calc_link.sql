-- 할일 제목 한 줄에 여러 품목을 텍스트로 욱여넣던 방식을, 매입/매출
-- 등록 폼과 같은 형태의 구조화된 품목 목록으로 바꾼다. items는
-- {productId, spec, quantity}[] 형태의 jsonb다. memo는 품목과 무관한
-- 순수 자유 메모로 계속 남는다.
alter table public.todos
  add column if not exists items jsonb not null default '[]'::jsonb;

-- 할일 단계에서 미리 해본 모조지 계산도 매출/매입과 동일한 방식으로
-- 연결해서 저장할 수 있게 한다. sales_order_id/purchase_order_id와
-- 마찬가지로 null을 허용하고, 할일이 삭제돼도 계산 이력 자체는 남긴다.
alter table public.paper_calculations
  add column if not exists todo_id uuid references public.todos (id) on delete set null;

create index if not exists paper_calculations_todo_id_idx
  on public.paper_calculations (todo_id);
