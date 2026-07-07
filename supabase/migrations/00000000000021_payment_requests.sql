-- 보고서 > 지급결의양식: 게시판형(제목 목록 -> 클릭시 본문) 지급결의 문서.
-- 엑셀 다운로드 양식은 추후 예정이라 이번엔 제목/본문/작성자/금액/작성일만 다룬다.
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  amount numeric(14, 2),
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.payment_requests enable row level security;

do $$ begin
  create policy "payment_requests_select_authenticated" on public.payment_requests
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "payment_requests_insert_authenticated" on public.payment_requests
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "payment_requests_update_authenticated" on public.payment_requests
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "payment_requests_delete_authenticated" on public.payment_requests
    for delete using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
