"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { startRouteProgress } from "@/lib/route-progress";
import { hasTextSelection } from "@/lib/has-text-selection";

export function ClickableRow({
  href,
  children,
  className,
  style,
  onActivate,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** 주면 행을 눌러도 이동하지 않고 이 함수만 부른다(오른쪽 상세 패널에 선택) — 이동은 패널의 "상세 보기"로. */
  onActivate?: () => void;
}) {
  const router = useRouter();

  // 행 안에 별도 링크(예: 명세표 인쇄 링크)나 체크박스 같은 자체 클릭
  // 동작이 있으면(closest("a") 또는 클릭 핸들러 안에서 stopPropagation)
  // 그쪽 동작을 우선하고, 행 전체 이동은 건너뛴다.
  function handleClick(e: MouseEvent<HTMLTableRowElement>) {
    if ((e.target as HTMLElement).closest("a")) return;
    // 칸을 드래그해 고르던 중이면(합계 보기 등) 이동하지 않는다.
    if (hasTextSelection()) return;
    if (onActivate) {
      onActivate();
      return;
    }
    startRouteProgress();
    router.push(href);
  }

  return (
    <tr
      onClick={handleClick}
      className={`cursor-pointer${className ? ` ${className}` : ""}`}
      style={style}
    >
      {children}
    </tr>
  );
}
