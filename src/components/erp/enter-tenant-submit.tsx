"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { startRouteProgress } from "@/lib/route-progress";

// "회사 전환"(리본 모달)과 "이 회사로 들어가기"(고객사 상세)가 같이 쓰는 제출 버튼.
// 서버 액션이 끝나고 대시보드가 다시 그려질 때까지 수 초 걸릴 수 있는데, 그동안
// 아무 표시가 없으면 눌렸는지 알 수 없다 — 눌린 즉시 상단 로딩바 + 버튼 문구 + 중복 클릭 방지.
export function EnterTenantSubmit({
  label,
  className,
  title,
}: {
  label: string;
  className: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  useEffect(() => {
    if (pending) startRouteProgress();
  }, [pending]);

  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className} title={title}>
      <span>{pending ? "들어가는 중... 잠시만요" : label}</span>
    </button>
  );
}
