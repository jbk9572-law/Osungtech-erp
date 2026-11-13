-- 메인 대시보드 위젯 배치(위치·크기·숨김) — 사람마다 원하는 화면이 달라서 user_id당 한 행으로
-- 계정별 저장한다(칸 숨김 설정 ui_grid_column_visibility와 같은 방식).
-- layout은 { items: [{id,x,y,w,h}], hidden: [id] } 모양이며, 읽을 때 앱이 항상 검증·보정한다
-- (src/lib/dashboard-layout.ts). DB에서는 용량만 막는다(악의적으로 큰 값 저장 방지).
create table if not exists public.ui_dashboard_layout (
  user_id uuid primary key references auth.users (id) on delete cascade,
  layout jsonb not null,
  updated_at timestamptz not null default now(),
  constraint ui_dashboard_layout_size check (pg_column_size(layout) <= 8192)
);

alter table public.ui_dashboard_layout enable row level security;

create policy "ui_dashboard_layout_select_own" on public.ui_dashboard_layout
  for select using (user_id = auth.uid());
create policy "ui_dashboard_layout_insert_own" on public.ui_dashboard_layout
  for insert with check (user_id = auth.uid());
create policy "ui_dashboard_layout_update_own" on public.ui_dashboard_layout
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ui_dashboard_layout_delete_own" on public.ui_dashboard_layout
  for delete using (user_id = auth.uid());
