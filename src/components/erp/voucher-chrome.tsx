"use client";

import type { ReactNode } from "react";
import { DraftSavedIndicator } from "@/components/draft-saved-indicator";
import { useThemeFeatures } from "@/lib/erp-theme-features";
import { formatNumber } from "@/lib/format-number";

// 매출/매입 전표 등록 모달의 "틀" — 테마에 따라 구조 자체가 다르다.
//  · 클래식: 가운데 제목 + "기본정보" 머리줄(오른쪽에 저장 버튼) + 표 아래 합계.
//  · voucherLayout 테마: 왼쪽 제목 + 상태 칩 한 줄, 머리줄 없음, 아래 고정 바(합계금액 + 저장 버튼).
// 두 전표 폼이 같은 조각을 쓰므로 한 곳을 고치면 둘 다 바뀐다.

/** 전표 제목. 상태 칩(임시저장 시각, 이월, 샘플 등)은 children으로 받는다. */
export function VoucherTitle({ title, savedAt, children }: { title: string; savedAt: number | null; children?: ReactNode }) {
  const { voucherLayout } = useThemeFeatures();
  if (!voucherLayout) return <h2 className="erp-doc-title">{title.split("").join(" ")}</h2>;
  return (
    <div className="erp-voucher-titlebar">
      <h2 className="erp-voucher-title">{title}</h2>
      <DraftSavedIndicator savedAt={savedAt} />
      {children}
    </div>
  );
}

/** "기본정보" 머리줄 — 클래식만 그린다(저장 버튼이 여기 있다). voucherLayout 테마는 하단 바로 옮겨 간다. */
export function VoucherBasicHead({ actions }: { actions: ReactNode }) {
  const { voucherLayout } = useThemeFeatures();
  if (voucherLayout) return null;
  return (
    <div className="erp-form-section-head">
      <span className="erp-eyebrow erp-u-m-0">기본정보</span>
      {actions}
    </div>
  );
}

/** 하단 고정 바 — voucherLayout 테마만. 합계금액과 저장 버튼. */
export function VoucherFooter({ supply, tax, total, actions }: { supply: number; tax: number; total: number; actions: ReactNode }) {
  const { voucherLayout } = useThemeFeatures();
  if (!voucherLayout) return null;
  return (
    <div className="erp-voucher-footer">
      <div className="erp-voucher-footer-sum">
        <span className="erp-u-muted erp-u-text-xs">
          공급가액 {formatNumber(supply)} · 부가세 {formatNumber(tax)}
        </span>
        <span className="erp-voucher-footer-label">합계금액</span>
        <b className="erp-voucher-footer-total">{formatNumber(total)}원</b>
      </div>
      {actions}
    </div>
  );
}

/** 상태 칩 한 개(예: "이월 처리", "샘플"). */
export function VoucherChip({ tone = "muted", children }: { tone?: "muted" | "info" | "warning"; children: ReactNode }) {
  return <span className={`erp-voucher-chip erp-voucher-chip-${tone}`}>{children}</span>;
}
