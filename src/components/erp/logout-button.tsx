"use client";

import type { CSSProperties } from "react";
import { useFormStatus } from "react-dom";

// 로그아웃 서버 액션이 Supabase Auth 서버 응답을 기다리는 동안(특히
// 무료 플랜 DB가 느릴 때) 버튼에 아무 반응이 없으면 "눌러도 안 먹힌다"고
// 오해해서 새로고침해버리는 제보가 있었다 — 실제로는 처리 중이었을 뿐인데
// 아무 피드백이 없어서 멈춘 것처럼 보였다. useFormStatus로 부모 <form>의
// 진행 상태를 읽어 버튼을 비활성화하고 문구를 바꿔서, 느려도 "처리
// 중"이라는 게 보이게 한다 — 내부 직원용(title-bar.tsx)과 거래처/업체
// 포털용(portal/(app)/layout.tsx) 로그아웃 버튼 둘 다 이 컴포넌트를
// 공유한다.
export function LogoutButton({ className, style }: { className?: string; style?: CSSProperties }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} style={style}>
      {pending ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
