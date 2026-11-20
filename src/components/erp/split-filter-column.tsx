"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useThemeFeatures } from "@/lib/erp-theme-features";

export type SplitFilterItem = {
  key: string;
  label: string;
  /** 건수 — 주면 오른쪽에 작게 보인다. */
  count?: number;
  active: boolean;
  /** 서버 화면은 href(주소 파라미터), 클라이언트 화면은 onSelect(상태)로 거른다. */
  href?: string;
  onSelect?: () => void;
};

export type SplitFilterGroup = { heading?: string; items: SplitFilterItem[] };

// B형(소통형 3분할)의 왼쪽 필터 열 — 상태·유형·담당처럼 "분류로 거르는" 항목과 건수를 한 모양으로 그린다.
// 할일·메일·게시판·공지·문서양식이 같은 마크업/CSS(.erp-split3-filter)를 쓰게 한 곳에서 관리한다(개발헌법 12번).
export function SplitFilterColumn({ groups, ariaLabel, children, className }: { groups: SplitFilterGroup[]; ariaLabel: string; children?: ReactNode; className?: string }) {
  // 평평한 띠·왼쪽 강조선 모양(.erp-split3-filter)은 모던 테마에서만 — 클래식은 예전 필터 열 모양 그대로(테마별 화면 분리).
  const { listSidePanel } = useThemeFeatures();
  return (
    <nav className={`erp-cat-sidebar${listSidePanel ? " erp-split3-filter" : ""}${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      {groups.map((g, gi) => (
        <div key={g.heading ?? gi} className="erp-split3-filter-group">
          {g.heading && <div className="erp-split3-filter-heading">{g.heading}</div>}
          {g.items.map((it) => {
            const body = (
              <>
                <span>{it.label}</span>
                {it.count !== undefined && <span className="cnt">{it.count}</span>}
              </>
            );
            const cls = `erp-cat-item${it.active ? " active" : ""}`;
            return it.href ? (
              <Link key={it.key} href={it.href} className={cls} aria-current={it.active ? "true" : undefined}>
                {body}
              </Link>
            ) : (
              <button key={it.key} type="button" onClick={it.onSelect} className={cls} aria-pressed={it.active}>
                {body}
              </button>
            );
          })}
        </div>
      ))}
      {children}
    </nav>
  );
}
