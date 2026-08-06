-- 지급결의서에 영수증 사진을 여러 장 첨부할 수 있게 한다. 실제 업무 방식
-- (영수증을 순서대로 스테이플러로 정리해서 제출)을 그대로 반영해서, 사진마다
-- sort_order를 둬 화면에서도 그 순서대로 보여준다.
create table if not exists public.payment_request_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references public.payment_requests (id) on delete cascade,
  file_path text not null,
  file_url text not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payment_request_receipts_payment_request_id_idx
  on public.payment_request_receipts (payment_request_id);

alter table public.payment_request_receipts enable row level security;

drop policy if exists "payment_request_receipts_select_authenticated" on public.payment_request_receipts;
create policy "payment_request_receipts_select_authenticated" on public.payment_request_receipts
  for select using (auth.role() = 'authenticated');
drop policy if exists "payment_request_receipts_insert_authenticated" on public.payment_request_receipts;
create policy "payment_request_receipts_insert_authenticated" on public.payment_request_receipts
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "payment_request_receipts_delete_authenticated" on public.payment_request_receipts;
create policy "payment_request_receipts_delete_authenticated" on public.payment_request_receipts
  for delete using (auth.role() = 'authenticated');

-- 영수증 사진 전용 스토리지 버킷 (공개 읽기, 로그인 사용자만 업로드/삭제).
-- 업로드 전 브라우저에서 리사이즈/재압축해서 올리므로(장당 대략 150~300KB),
-- 무료 플랜 Storage 1GB로도 수천 장을 감당할 수 있다.
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', true)
on conflict (id) do nothing;

drop policy if exists "payment_receipts_public_read" on storage.objects;
create policy "payment_receipts_public_read" on storage.objects
  for select using (bucket_id = 'payment-receipts');
drop policy if exists "payment_receipts_authenticated_insert" on storage.objects;
create policy "payment_receipts_authenticated_insert" on storage.objects
  for insert with check (bucket_id = 'payment-receipts' and auth.role() = 'authenticated');
drop policy if exists "payment_receipts_authenticated_delete" on storage.objects;
create policy "payment_receipts_authenticated_delete" on storage.objects
  for delete using (bucket_id = 'payment-receipts' and auth.role() = 'authenticated');
