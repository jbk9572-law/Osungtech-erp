-- 할일(Todo) 리스트 + 공지사항 게시판
-- 팀 전체가 공유하는 목록(달력 메모/지급결의서와 동일한 접근 권한 방식)이며,
-- 공지사항은 사용자별 읽음 여부를 announcement_reads로 추적해 안 읽은
-- 개수를 뱃지로 보여줄 수 있게 한다.

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  memo text not null default '',
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_todos_updated_at on public.todos;
create trigger set_todos_updated_at
  before update on public.todos
  for each row execute procedure public.set_updated_at();

alter table public.todos enable row level security;

drop policy if exists "todos_select_authenticated" on public.todos;
create policy "todos_select_authenticated" on public.todos
  for select using (auth.role() = 'authenticated');
drop policy if exists "todos_insert_authenticated" on public.todos;
create policy "todos_insert_authenticated" on public.todos
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "todos_update_authenticated" on public.todos;
create policy "todos_update_authenticated" on public.todos
  for update using (auth.role() = 'authenticated');
drop policy if exists "todos_delete_authenticated" on public.todos;
create policy "todos_delete_authenticated" on public.todos
  for delete using (auth.role() = 'authenticated');

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  pinned boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at
  before update on public.announcements
  for each row execute procedure public.set_updated_at();

alter table public.announcements enable row level security;

drop policy if exists "announcements_select_authenticated" on public.announcements;
create policy "announcements_select_authenticated" on public.announcements
  for select using (auth.role() = 'authenticated');
drop policy if exists "announcements_insert_authenticated" on public.announcements;
create policy "announcements_insert_authenticated" on public.announcements
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "announcements_update_authenticated" on public.announcements;
create policy "announcements_update_authenticated" on public.announcements
  for update using (auth.role() = 'authenticated');
drop policy if exists "announcements_delete_authenticated" on public.announcements;
create policy "announcements_delete_authenticated" on public.announcements
  for delete using (auth.role() = 'authenticated');

-- 공지사항 읽음 여부(사용자별) — 안 읽은 개수 뱃지 계산용.
create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.announcement_reads enable row level security;

drop policy if exists "announcement_reads_select_own" on public.announcement_reads;
create policy "announcement_reads_select_own" on public.announcement_reads
  for select using (auth.uid() = user_id);
drop policy if exists "announcement_reads_insert_own" on public.announcement_reads;
create policy "announcement_reads_insert_own" on public.announcement_reads
  for insert with check (auth.uid() = user_id);
