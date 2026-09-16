-- 매출/매입 등록 폼 품목 그리드의 칸 너비를 드래그로 조절하는 기능을
-- 브라우저 localStorage에 저장해왔는데, 이러면 "내 브라우저에서만" 고쳐진
-- 걸로 보이고 다른 직원 컴퓨터/다른 브라우저에서는 여전히 예전(깨져
-- 보이는) 너비 그대로 보인다는 지적 — 회사 전체가 같이 쓰는 화면
-- 설정이니 다른 공유 설정들처럼 DB에 저장해서 누가 조절하든 전 직원
-- 화면에 반영되게 한다.
--
-- grid_key(예: "sale-item-grid", "purchase-item-grid-dual")별로 최근
-- 저장된 너비 값(jsonb: {컬럼명: px 숫자})을 한 행에 담아둔다. 데모
-- 계정은 실제 계정과 화면을 공유하면 안 되므로(migration 85와 동일한
-- 이유) company_profile(migration 86)과 같은 방식 — 싱글턴이 아니라
-- grid_key별로 "실제용 행 하나 + 데모용 행 하나"까지만 허용한다.
create table if not exists public.ui_grid_column_widths (
  id uuid primary key default gen_random_uuid(),
  grid_key text not null,
  widths jsonb not null,
  is_demo boolean not null default public.is_demo_actor(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ui_grid_column_widths_key_tenant
  on public.ui_grid_column_widths (grid_key, is_demo);

alter table public.ui_grid_column_widths enable row level security;

-- 표 너비 조절은 관리자 전용 기능이 아니라 등록 화면을 쓰는 누구나
-- 하는 조작이므로, locations/inventory_locations(migration 91)과 같은
-- 패턴으로 로그인한 사용자면 조회/저장 모두 가능하게 한다.
create policy "ui_grid_column_widths_select_authenticated" on public.ui_grid_column_widths
  for select using (auth.role() = 'authenticated');
create policy "ui_grid_column_widths_insert_authenticated" on public.ui_grid_column_widths
  for insert with check (auth.role() = 'authenticated');
create policy "ui_grid_column_widths_update_authenticated" on public.ui_grid_column_widths
  for update using (auth.role() = 'authenticated');

create policy "ui_grid_column_widths_demo_isolation" on public.ui_grid_column_widths
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());
