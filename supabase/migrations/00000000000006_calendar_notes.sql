-- 대시보드 달력 메모
create table if not exists public.calendar_notes (
  id uuid primary key default gen_random_uuid(),
  note_date date not null unique,
  content text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_calendar_notes_updated_at on public.calendar_notes;
create trigger set_calendar_notes_updated_at
  before update on public.calendar_notes
  for each row execute procedure public.set_updated_at();

alter table public.calendar_notes enable row level security;

create policy "calendar_notes_select_authenticated" on public.calendar_notes
  for select using (auth.role() = 'authenticated');
create policy "calendar_notes_insert_authenticated" on public.calendar_notes
  for insert with check (auth.role() = 'authenticated');
create policy "calendar_notes_update_authenticated" on public.calendar_notes
  for update using (auth.role() = 'authenticated');
