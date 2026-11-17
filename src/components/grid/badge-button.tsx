"use client";

import type { ReactNode } from "react";
import { TONE_CLASS, type BadgeTone } from "@/components/grid/badge";

/** 눌러서 동작하는 뱃지(예: "포털 계정 없음 · 발급하기"). */
export function GridBadgeButton({
  tone = "warn",
  onClick,
  children,
  title,
}: {
  tone?: BadgeTone;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`erp-badge ${TONE_CLASS[tone]} erp-u-border-none erp-u-pointer erp-u-w-fit`}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
