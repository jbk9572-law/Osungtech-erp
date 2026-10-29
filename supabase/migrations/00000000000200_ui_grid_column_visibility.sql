-- 매출/매입 등 가로형 표의 "보고 싶은 칸만 보기" 설정.
--
-- migration 097의 칸 너비(ui_grid_column_widths)는 "회사 전체가 같이
-- 보는 화면이니 전 직원 화면에 반영돼야 한다"는 이유로 grid_key당 행
-- 하나를 전 직원이 공유했다. 칸 숨김/보임은 정반대 성격이다 — "어떤
-- 칸이 필요한지는 사람마다 다를 수 있다"는 요청이라, grid_key +
-- user_id 조합으로 계정마다 따로 저장한다.
create table if not exists public.ui_grid_column_visibility (
  id uuid primary key default gen_random_uuid(),
  grid_key text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  hidden_columns text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create unique index if not exists ui_grid_column_visibility_key_user
  on public.ui_grid_column_visibility (grid_key, user_id);

alter table public.ui_grid_column_visibility enable row level security;

-- 자기 설정만 보고 고칠 수 있다 — 다른 직원 화면 설정을 볼 이유가 없다
-- (칸 너비와 다르게 전 직원 공유가 아니므로).
create policy "ui_grid_column_visibility_select_own" on public.ui_grid_column_visibility
  for select using (user_id = auth.uid());
create policy "ui_grid_column_visibility_insert_own" on public.ui_grid_column_visibility
  for insert with check (user_id = auth.uid());
create policy "ui_grid_column_visibility_update_own" on public.ui_grid_column_visibility
  for update using (user_id = auth.uid());
create policy "ui_grid_column_visibility_delete_own" on public.ui_grid_column_visibility
  for delete using (user_id = auth.uid());
