"use client";

import { CloseButton } from "@/components/erp/close-button";
import { PrintButton } from "@/components/print-button";
import { useThemeFeatures } from "@/lib/erp-theme-features";

// 인쇄 화면(명세표·견적서·급여명세·생산지시·실사목록 등)의 맨 위 도구줄 — [닫기] + [인쇄하기]. 화면마다 같은 마크업을 복붙해 들고 있던 것을 한 곳으로.
//  · 클래식: 왼쪽 닫기, 오른쪽 인쇄(기존 모양 그대로).
//  · voucherLayout 테마: 전표 화면과 같은 제목(.erp-voucher-title) + 오른쪽 [닫기][인쇄하기] 한 줄, 아래 얇은 선.
// 인쇄물 자체(종이 서식)는 테마와 무관하게 그대로다 — 이 도구줄은 전부 print:hidden 이라 종이에 찍히지 않는다.
export function PrintToolbar({
  closeHref,
  closeLabel = "목록으로",
  title,
  autoPrint = true,
}: {
  closeHref: string;
  closeLabel?: string;
  /** voucherLayout 테마에서 도구줄 왼쪽에 보이는 화면 이름(예: "거래명세표 인쇄") */
  title: string;
  /** 화면을 열자마자 인쇄 대화상자를 띄울지 — 인쇄 전에 옵션을 고르는 화면은 false */
  autoPrint?: boolean;
}) {
  const { voucherLayout } = useThemeFeatures();
  if (!voucherLayout) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <CloseButton href={closeHref} className="erp-btn erp-btn-dark print:hidden">
          {closeLabel}
        </CloseButton>
        <PrintButton autoPrint={autoPrint} />
      </div>
    );
  }
  return (
    <div className="erp-print-toolbar print:hidden">
      <h2 className="erp-voucher-title">{title}</h2>
      <span className="erp-print-toolbar-spacer" />
      <CloseButton href={closeHref} className="erp-btn">
        {closeLabel}
      </CloseButton>
      <PrintButton autoPrint={autoPrint} />
    </div>
  );
}
