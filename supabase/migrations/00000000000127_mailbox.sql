-- 그룹웨어 1단계: ERP 안에서 쓰는 메일함.
--
-- 실제 메일 서버(스팸 필터링/저장/전송)는 새로 만들지 않는다 — 사용자가
-- 이미 쓰고 있는 다음 스마트워크 계정을 그대로 "빌려" 쓴다. 이 앱은
-- 아웃룩이나 다음 웹메일과 똑같은 역할, 즉 IMAP으로 읽어오고 SMTP로
-- 보내는 "클라이언트"일 뿐이다. 그래서:
--   - mail_accounts: 사용자가 등록한 외부 메일 계정 접속 정보(계정당 1명
--     소유, 앱 비밀번호는 애플리케이션 레이어에서 암호화해서 저장한다 —
--     src/lib/mail/crypto.ts 참고. DB에는 암호문만 남는다).
--   - mail_messages: IMAP에서 동기화해온 메일 메타데이터 + 본문 캐시.
--     실제 원본은 계속 다음 서버에 있고, 여기는 화면에 빠르게 보여주기
--     위한 로컬 사본이다.
--   - mail_attachments: 첨부파일은 Storage 버킷에 올리고 경로만 저장한다
--     (branding 버킷과 동일한 패턴).
--
-- 다른 업무 테이블들과 마찬가지로 tenant_id(RESTRICTIVE) + 소유자 판별
-- (PERMISSIVE)을 이중으로 건다 — migration 99와 동일한 틀. 메일함은
-- 본질적으로 "내 개인 계정"이라 같은 회사 동료도 남의 메일함을 볼 필요가
-- 없으므로, permissive 정책은 tenant 전체가 아니라 user_id 본인으로 좁힌다.

create table public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email_address text not null,
  display_name text,
  imap_host text not null default 'imap.daum.net',
  imap_port integer not null default 993,
  smtp_host text not null default 'smtp.daum.net',
  smtp_port integer not null default 465,
  username text not null,
  -- AES-GCM 암호문(base64: iv + ciphertext). 평문 비밀번호는 절대 저장하지 않는다.
  encrypted_app_password text not null,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  last_sync_error text,
  -- 폴더별 마지막으로 동기화한 IMAP UID(증분 동기화용). {"INBOX": 1234, ...}
  last_synced_uid jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index mail_accounts_tenant_id_idx on public.mail_accounts (tenant_id);

alter table public.mail_accounts enable row level security;

create policy "mail_accounts_tenant_isolation" on public.mail_accounts
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "mail_accounts_own" on public.mail_accounts
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  mail_account_id uuid not null references public.mail_accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  folder text not null,
  uid bigint not null,
  message_id text,
  subject text,
  from_address text,
  from_name text,
  to_addresses jsonb not null default '[]'::jsonb,
  cc_addresses jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  body_text text,
  body_html text,
  snippet text,
  has_attachments boolean not null default false,
  is_read boolean not null default false,
  is_starred boolean not null default false,
  size_bytes integer,
  created_at timestamptz not null default now(),
  unique (mail_account_id, folder, uid)
);

create index mail_messages_tenant_id_idx on public.mail_messages (tenant_id);
create index mail_messages_account_folder_idx on public.mail_messages (mail_account_id, folder, sent_at desc);

alter table public.mail_messages enable row level security;

create policy "mail_messages_tenant_isolation" on public.mail_messages
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "mail_messages_own" on public.mail_messages
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table public.mail_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  mail_message_id uuid not null references public.mail_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  filename text not null,
  content_type text,
  size_bytes integer,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index mail_attachments_message_id_idx on public.mail_attachments (mail_message_id);

alter table public.mail_attachments enable row level security;

create policy "mail_attachments_tenant_isolation" on public.mail_attachments
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "mail_attachments_own" on public.mail_attachments
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 첨부파일 저장용 버킷(branding 버킷과 동일한 패턴: private 버킷 +
-- 소유자 본인만 read/write). 목록/다운로드는 서버 액션에서 서명된 URL로
-- 내려주므로 버킷 자체는 public일 필요가 없다.
insert into storage.buckets (id, name, public)
values ('mail-attachments', 'mail-attachments', false)
on conflict (id) do nothing;

create policy "mail_attachments_storage_own" on storage.objects
  for all
  using (bucket_id = 'mail-attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'mail-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
