"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { startRouteProgress } from "@/lib/route-progress";

export function ClickableRow({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  // 행 안에 별도 링크(예: 명세표 인쇄 링크)나 체크박스 같은 자체 클릭
  // 동작이 있으면(closest("a") 또는 클릭 핸들러 안에서 stopPropagation)
  // 그쪽 동작을 우선하고, 행 전체 이동은 건너뛴다.
  function handleClick(e: MouseEvent<HTMLTableRowElement>) {
    if ((e.target as HTMLElement).closest("a")) return;
    startRouteProgress();
    router.push(href);
  }

  return (
    <tr
      onClick={handleClick}
      className={`cursor-pointer${className ? ` ${className}` : ""}`}
    >
      {children}
    </tr>
  );
}
