-- profiles_update_own(본인 프로필만 수정 가능)이 migration 40에서
-- profiles_update_by_admin(관리자는 전체 수정 가능)을 추가한 뒤로도 안
-- 지워진 채 같이 남아 있었다. Postgres RLS는 같은 명령(UPDATE)에 대한
-- 여러 permissive 정책을 OR로 합치기 때문에, 일반 직원 계정도 여전히
-- profiles_update_own 정책을 통해 자기 자신의 role을 'admin'으로 바꿔
-- 권한을 상승시킬 수 있는 구멍이 있었다. 코드베이스 전체를 확인한 결과
-- 일반 사용자가 본인 프로필을 직접 수정하는 흐름은 없고(계정/역할 변경은
-- settings/users/actions.ts에서 관리자만 수행), 조회는 profiles_select_own이
-- 계속 담당하므로 update 정책만 제거하면 된다.
drop policy if exists "profiles_update_own" on public.profiles;

-- company_profile(회사 상호/사업자정보/로고·도장 이미지)도 지금까지 로그인한
-- 모든 사용자가 수정 가능한 정책(company_profile_update_authenticated)만
-- 있었다. 화면(설정 > 회사정보)에는 접근 제한이 없었고, 이번에 Server
-- Action에 관리자 체크를 추가하면서 DB 쪽도 같이 관리자 전용으로 좁힌다 —
-- profiles_update_own과 같은 이유로, 화면 체크만 믿고 있으면 API를 직접
-- 호출해 우회할 수 있기 때문이다.
drop policy if exists "company_profile_update_authenticated" on public.company_profile;
create policy "company_profile_update_admin" on public.company_profile
  for update using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );
