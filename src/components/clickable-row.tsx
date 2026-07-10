"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

export function ClickableRow({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();

  // 행 안에 별도 링크(예: 명세표 인쇄 링크)가 있으면 그 링크 자체 동작(새 탭 열기
  // 등)을 우선하고, 행 전체 이동은 건너뛴다.
  function handleClick(e: MouseEvent<HTMLTableRowElement>) {
    if ((e.target as HTMLElement).closest("a")) return;
    router.push(href);
  }

  return (
    <tr onClick={handleClick} className="cursor-pointer">
      {children}
    </tr>
  );
}
