-- 사내메신저: 회사 전체가 함께 쓰는 공용 채팅방 1개 + 파일 첨부.

create table if not exists public.messenger_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles (id) on delete set null,
  content text not null default '',
  file_url text,
  file_path text,
  file_name text,
  file_size bigint,
  created_at timestamptz not null default now()
);

alter table public.messenger_messages enable row level security;

drop policy if exists "messenger_messages_select_authenticated" on public.messenger_messages;
create policy "messenger_messages_select_authenticated" on public.messenger_messages
  for select using (auth.role() = 'authenticated');
drop policy if exists "messenger_messages_insert_own" on public.messenger_messages;
create policy "messenger_messages_insert_own" on public.messenger_messages
  for insert with check (auth.role() = 'authenticated' and sender_id = auth.uid());
drop policy if exists "messenger_messages_delete_own" on public.messenger_messages;
create policy "messenger_messages_delete_own" on public.messenger_messages
  for delete using (sender_id = auth.uid());

-- 실시간 구독(Supabase Realtime)이 이 테이블의 변경을 방송하도록 등록.
-- 이미 등록돼 있으면 조용히 건너뛴다(재실행 대비).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messenger_messages'
  ) then
    alter publication supabase_realtime add table public.messenger_messages;
  end if;
end $$;

-- 파일첨부용 스토리지 버킷 (공개 읽기, 로그인 사용자만 업로드/삭제).
insert into storage.buckets (id, name, public)
values ('messenger-attachments', 'messenger-attachments', true)
on conflict (id) do nothing;

drop policy if exists "messenger_attachments_public_read" on storage.objects;
create policy "messenger_attachments_public_read" on storage.objects
  for select using (bucket_id = 'messenger-attachments');
drop policy if exists "messenger_attachments_authenticated_insert" on storage.objects;
create policy "messenger_attachments_authenticated_insert" on storage.objects
  for insert with check (bucket_id = 'messenger-attachments' and auth.role() = 'authenticated');
drop policy if exists "messenger_attachments_authenticated_delete" on storage.objects;
create policy "messenger_attachments_authenticated_delete" on storage.objects
  for delete using (bucket_id = 'messenger-attachments' and auth.role() = 'authenticated');

-- 사내메신저에서 서로 이름을 보려면 다른 구성원의 프로필도 조회할 수 있어야 한다.
-- 기존엔 본인 프로필만 조회 가능해서(profiles_select_own) 다른 사람이 쓴 메시지의
-- 작성자 이름이 안 보였다. 사내 시스템이라 이름 정도는 서로 봐도 되는 정보다.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');
