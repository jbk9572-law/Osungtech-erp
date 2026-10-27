-- 파일 저장소 쿼터를 300MB -> 1GB로 올린다.
--
-- 186에서 300MB로 잡았던 이유는 그때 파일이 Supabase Storage(테넌트
-- 전체가 나눠 쓰는 무료 1GB)에 저장되고 있어서였다 — 그런데 메일/
-- 메신저/영수증 첨부를 전부 Cloudflare R2로 옮기면서(187 이후 커밋)
-- 그 제약이 사라졌다. R2는 10GB까지 무료고 그 이후도 다운로드 비용
-- 없이 GB당 월 몇 센트 수준이라, 파일 쿼터는 더 이상 원가에 민감한
-- 자원이 아니다. DB 쿼터(50MB)는 여전히 Supabase Postgres를 그대로
-- 쓰고 있어 원가 부담이 남아있으므로 손대지 않는다.
alter table public.tenants alter column file_quota_bytes set default 1073741824; -- 1GB

-- 기본값이 바뀐 이후 새로 만들어지는 테넌트는 위 default로 자동
-- 적용되지만, 이미 만들어진 테넌트는 default 변경의 영향을 받지 않아
-- update를 같이 해준다. 아직 300MB 기본값 그대로인 테넌트만 올리고,
-- 플랫폼 운영자가 특정 회사에 수동으로 다른 값을 넣어둔 경우(마이그
-- 레이션 186의 TenantQuotaPanel)는 건드리지 않는다.
update public.tenants set file_quota_bytes = 1073741824 where file_quota_bytes = 314572800;
