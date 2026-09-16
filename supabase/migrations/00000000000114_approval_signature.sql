-- 전자서명 등록 — 구성원이 본인 서명 이미지를 등록해두면, 결재 상세
-- 화면에서 "승인" 배지 대신(또는 함께) 그 서명 이미지가 표시된다.
-- 저장 위치는 회사 로고/도장과 같은 기존 storage 버킷('branding', 공개
-- 읽기+로그인 사용자 쓰기 정책이 이미 있음)의 signatures/ 하위 경로를
-- 재사용한다 — 새 버킷을 또 만들 필요 없이 정책도 그대로 적용된다.
-- 경로 자체(signatures/{user_id}.png)는 서버 액션이 auth.uid()로부터
-- 직접 만들어서 클라이언트가 다른 사람의 경로를 지정할 수 없게 한다.
alter table public.profiles add column if not exists signature_image_url text;

-- 본인 서명 이미지만 바꿀 수 있는 좁은 통로 — profiles 테이블은
-- migration 053(fix_rls_privilege_escalation)에서 "본인 프로필 update"
-- 정책을 아예 없앴다(자기 role을 admin으로 바꿔치기할 수 있는 구멍이라).
-- 그 정책을 다시 열지 않고, security definer 함수로 signature_image_url
-- 한 컬럼만 갱신하는 통로를 새로 낸다 — role 등 다른 컬럼은 이 함수를
-- 통해서는 절대 바뀌지 않는다.
create or replace function public.update_own_signature(p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  update public.profiles set signature_image_url = p_url where id = auth.uid();
end;
$$;

revoke all on function public.update_own_signature(text) from public;
grant execute on function public.update_own_signature(text) to authenticated;
