-- 버그: company_profile(회사정보)이 데모 계정 격리(migration 85)에서
-- 빠져 있었다. 이 테이블은 "id integer primary key default 1" +
-- "id = 1만 허용" 체크 제약으로 진짜 싱글턴이라, 다른 테이블처럼 그냥
-- is_demo 컬럼만 얹고 RESTRICTIVE 정책을 걸어도 데모용 행을 애초에 만들
-- 수가 없었다(행이 오직 하나, id=1, 그게 곧 실제 회사 정보). 그 결과
-- 데모 계정이 설정 > 회사정보에서 상호명 등을 수정하면, 화면 코드가
-- 전부 .eq("id", 1)로 그 유일한 행을 가리키고 있어서 실제 회사 정보를
-- 그대로 덮어써버렸다(사용자 보고: "상호명 변경하면 같이 틀어져버리네").
--
-- 고치는 방법: 싱글턴 제약을 풀어서 "실제용 행 하나 + 데모용 행 하나"
-- 최대 2행까지 허용하고(is_demo 컬럼에 유니크 제약을 걸면 자동으로
-- 이렇게 된다), 데모용 행을 하나 미리 만들어둔다. 다른 테이블과 동일한
-- RESTRICTIVE 정책을 걸어서 실제 계정은 실제 행만, 데모 계정은 데모
-- 행만 보고 고칠 수 있게 한다. 애플리케이션 코드 쪽의 .eq("id", 1)은
-- 전부 제거해서(별도 커밋), RLS가 알아서 맞는 행 하나만 보여주게 한다
-- — 조회/수정 양쪽 다 id로 안 고르고 "지금 보이는 행"에 그대로
-- 적용되게 만드는 것이 핵심이다.

alter table public.company_profile drop constraint if exists company_profile_singleton;

alter table public.company_profile add column if not exists is_demo boolean not null default false;

-- 행이 최대 2개(is_demo=false 하나, is_demo=true 하나)만 존재하도록 강제.
create unique index if not exists company_profile_one_per_tenant on public.company_profile (is_demo);

drop policy if exists "company_profile_demo_isolation" on public.company_profile;
create policy "company_profile_demo_isolation" on public.company_profile
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

-- 데모용 회사정보 행을 미리 만들어둔다 — 없으면 데모 계정이 처음
-- 회사정보를 저장하려 할 때 업데이트 대상 행이 없어 조용히 아무 일도
-- 안 일어난다(0행 갱신). id=1은 실제 회사 행이 이미 쓰고 있으니 다른
-- 값을 쓴다. 로고/도장도 null로 두지 않고 처음부터 샘플 이미지를
-- 넣어둔다 — null로 두면 화면(BrandingSlot)의 defaultUrl이 그대로
-- 실제 회사 로고 경로라서 데모 화면에 진짜 로고/도장이 노출돼버린다.
insert into public.company_profile (id, name, is_demo, logo_wordmark_url, logo_mark_url, seal_image_url)
values (
  2, '샘플상사(주)', true,
  '/branding/sample-logo-wordmark.png',
  '/branding/sample-logo-mark.png',
  '/branding/sample-company-seal.png'
)
on conflict (id) do nothing;
