"use client";

import { quantityLabelByUnit } from "@/lib/quantity-by-unit";
import { useThemeFeatures } from "@/lib/erp-theme-features";
import { formatNumber } from "@/lib/format-number";

// 매출/매입 전표 품목 표의 맨 아래 합계 줄.
//  · 클래식: "합계" + 공급가액·부가세 + 큰 합계금액 한 칸.
//  · voucherLayout 테마: 표 칸에 맞춰 "합계 (N건)" · 수량 · 공급가액 · 세액 · 합계를 열마다 보여준다(스프레드시트 합계 줄).
// 칸 수(span)는 표의 보이는 열 수와 맞아야 한다 — 호출부가 자기 표 구조에 맞게 넘긴다.
export function OrderTotalsRow({
  count, quantity, qtyLines, supply, tax, total, classicSpans, voucherLeadSpan, voucherTrailSpan, label = "합계", classicOnly = false,
}: {
  count: number; quantity: number;
  /** 줄별 수량·단위 — 주면 단위가 섞인 전표를 "225 ROLL · 532 KG"처럼 단위별로 나눠 보여준다(숫자 합계 대신). */
  qtyLines?: { quantity: number; unit?: string | null }[];
  supply: number; tax: number; total: number;
  classicSpans: [number, number];
  voucherLeadSpan: number;
  voucherTrailSpan: number;
  /** 클래식 합계 줄 라벨(예: "매입 합계") */
  label?: string;
  /** 열 구성이 달라(예: 매입+매출 동시등록) 시안식 합계 줄을 못 그릴 때 true — 테마와 무관하게 클래식 줄을 그린다. */
  classicOnly?: boolean;
}) {
  const { voucherLayout } = useThemeFeatures();
  if (!voucherLayout || classicOnly) {
    return (
      <tr className="erp-u-bg-page">
        <td className="erp-u-bold" colSpan={classicSpans[0]}>{label}</td>
        <td className="num" colSpan={classicSpans[1]}>
          <div className="erp-u-muted">공급가액 {formatNumber(supply)}원 · 부가세 {formatNumber(tax)}원</div>
          <div className="erp-doc-total">{formatNumber(total)}원</div>
        </td>
      </tr>
    );
  }
  return (
    <tr className="erp-voucher-totals">
      <td colSpan={voucherLeadSpan}>합계 ({count}건)</td>
      <td className="num">{qtyLines ? quantityLabelByUnit(qtyLines) : formatNumber(quantity)}</td>
      <td />
      <td className="num">{formatNumber(supply)}</td>
      <td className="num">{formatNumber(tax)}</td>
      <td className="num">{formatNumber(total)}</td>
      <td colSpan={voucherTrailSpan} />
    </tr>
  );
}
