-- 매입/매출 주문 수정·삭제를 위한 RLS 정책 추가 (기존엔 select/insert만 있었음)
create policy "sales_orders_update_authenticated" on public.sales_orders
  for update using (auth.role() = 'authenticated');
create policy "sales_orders_delete_authenticated" on public.sales_orders
  for delete using (auth.role() = 'authenticated');

create policy "sales_order_items_update_authenticated" on public.sales_order_items
  for update using (auth.role() = 'authenticated');
create policy "sales_order_items_delete_authenticated" on public.sales_order_items
  for delete using (auth.role() = 'authenticated');

create policy "purchase_orders_update_authenticated" on public.purchase_orders
  for update using (auth.role() = 'authenticated');
create policy "purchase_orders_delete_authenticated" on public.purchase_orders
  for delete using (auth.role() = 'authenticated');

create policy "purchase_order_items_update_authenticated" on public.purchase_order_items
  for update using (auth.role() = 'authenticated');
create policy "purchase_order_items_delete_authenticated" on public.purchase_order_items
  for delete using (auth.role() = 'authenticated');

-- 회사 로고/도장 이미지를 설정 화면에서 직접 교체할 수 있도록 URL 컬럼 추가
-- (값이 없으면 앱은 public/branding 안의 기본 이미지를 사용)
alter table public.company_profile
  add column if not exists logo_wordmark_url text,
  add column if not exists logo_mark_url text,
  add column if not exists seal_image_url text;

-- 로고/도장 이미지를 올려둘 스토리지 버킷 (공개 읽기, 로그인 사용자만 업로드)
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy "branding_public_read" on storage.objects
  for select using (bucket_id = 'branding');
create policy "branding_authenticated_insert" on storage.objects
  for insert with check (bucket_id = 'branding' and auth.role() = 'authenticated');
create policy "branding_authenticated_update" on storage.objects
  for update using (bucket_id = 'branding' and auth.role() = 'authenticated');
create policy "branding_authenticated_delete" on storage.objects
  for delete using (bucket_id = 'branding' and auth.role() = 'authenticated');
