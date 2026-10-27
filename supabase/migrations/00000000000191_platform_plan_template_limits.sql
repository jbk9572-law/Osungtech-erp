-- "요금제 화면에 설명 문구만 있고, 실제로 숫자(DB 50MB 등)를 세팅하는
-- 방법이 관리자 페이지에 없다"는 지적 반영. platform_plans(카탈로그)는
-- 지금까지 description이 순수 텍스트라 "Standard는 DB 50MB"라고 안내
-- 문구에 적어놔도 실제로 그 숫자를 어디에도 입력할 데가 없었다 —
-- 쿼터 값은 여전히 tenants(실제 계약, migration 186/189와 같은 이유로
-- 수동 override 가능해야 함)에 최종 저장하지만, 그 "기본값 틀"을
-- 요금제 카탈로그에 구조화된 숫자로 함께 두고, 플랫폼 관리자가 고객사에
-- 그 요금제를 배정할 때 한 번에 적용(apply)할 수 있게 한다 — 그 뒤에도
-- 개별 고객사 쿼터는 그대로 수동 조정 가능(이 컬럼들은 "적용 시점의
-- 기본값"일 뿐, 적용 후엔 tenants 쪽 숫자가 그 고객사의 진짜 값).
alter table public.platform_plans add column if not exists included_db_mb integer;
alter table public.platform_plans add column if not exists included_file_gb integer;
alter table public.platform_plans add column if not exists included_vendor_limit integer;
alter table public.platform_plans add column if not exists included_email_quota integer;
alter table public.platform_plans add column if not exists included_fax_quota integer;

-- 이미 'standard' 키로 등록해둔 요금제가 있다면(기획서 2026-10-27 — DB
-- 50MB/파일 1GB/외주처 1개사/이메일·팩스 각 100건), 비어 있는 경우에만
-- 문서화된 기본값을 채워준다 — 운영자가 이미 다른 값을 넣어뒀다면
-- 덮어쓰지 않는다.
update public.platform_plans
set
  included_db_mb = coalesce(included_db_mb, 50),
  included_file_gb = coalesce(included_file_gb, 1),
  included_vendor_limit = coalesce(included_vendor_limit, 1),
  included_email_quota = coalesce(included_email_quota, 100),
  included_fax_quota = coalesce(included_fax_quota, 100)
where plan_key = 'standard';
