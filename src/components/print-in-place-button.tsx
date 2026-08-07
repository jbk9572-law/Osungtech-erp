"use client";

import type { ReactNode } from "react";
import { printInPlace } from "@/lib/print-in-place";

// 옵션 없는 인쇄 화면(지급결의양식 등)으로 이동할 때 새 탭을 띄우지 않고
// 바로 인쇄 대화상자만 뜨게 하는 버튼. 겉모습은 기존 erp-btn 링크와
// 똑같이 쓸 수 있도록 className을 그대로 받는다.
export function PrintInPlaceButton({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={() => printInPlace(href)} className={className}>
      {children}
    </button>
  );
}
