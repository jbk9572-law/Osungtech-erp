-- 점검 모드(유지보수 모드).
--
-- 대규모 마이그레이션/배포 작업 중에는 일반 회사(테넌트) 사용자가
-- 화면에 접근하지 못하게 막고 "점검 중" 안내만 보여줄 수 있어야 한다.
-- platform_settings는 이미 신규 테넌트 기본값(요금제/기능)을 담는
-- 싱글턴 테이블이라(migration 129), 여기에 점검 모드 컬럼을 얹는다.
-- 플랫폼 운영자는 이 값과 무관하게 항상 접근할 수 있다(꺼야 하는
-- 사람이 자기가 걸어놓은 점검 모드에 자기도 막히면 안 되므로).

alter table public.platform_settings
  add column if not exists maintenance_mode boolean not null default false,
  add column if not exists maintenance_message text;
