"use client";

import { NumberInput } from "@/components/number-input";
import { formatNumber } from "@/lib/format-number";
import { calcVat } from "@/lib/tax";

// 매출/매입 등록 폼의 품목 표 안에서, 임시 저장된 모조지 계산(TG0 자동 줄)과 그 계산에 들어간
// 사이즈별 참고 줄을 그리는 공용 부품. 두 폼이 글자 그대로 들고 있던 마크업을 한 곳으로 모았다.
// 매입 폼은 "매출도 같이 등록" 모드에서 수량/단가 칸이 입고·출고로 갈라져 칸이 2개 늘어나므로,
// 그 자리에 들어가는 대시 칸을 dashAfterQuantity / dashAfterUnit으로 받는다(매출 폼은 둘 다 생략).

type Tg0Product = { name: string; unit?: string | null };

export function PendingPaperCalcRow({
  tg0Product,
  quantity,
  onQuantityChange,
  unitAmount,
  amount,
  autoSheet,
  isOverridden,
  onCancel,
  dashAfterQuantity = false,
  dashAfterUnit = false,
}: {
  tg0Product: Tg0Product | undefined;
  quantity: number;
  onQuantityChange: (value: number) => void;
  unitAmount: number;
  amount: number;
  autoSheet: number;
  isOverridden: boolean;
  onCancel: () => void;
  dashAfterQuantity?: boolean;
  dashAfterUnit?: boolean;
}) {
  return (
    <tr className="erp-u-bg-info-bg">
      <td>
        {tg0Product ? (
          <>
            {tg0Product.name}
            <span
              className="ml-1 rounded px-1 text-[10.5px] erp-u-bg-info-border erp-u-color-info-text"
            >
              자동
            </span>
          </>
        ) : (
          <span className="erp-u-danger">SKU &apos;TG0&apos; 품목이 없어 자동 반영되지 않습니다</span>
        )}
      </td>
      <td className="erp-u-muted">-</td>
      <td className="erp-u-muted">-</td>
      <td className="erp-u-muted">{tg0Product?.unit ?? "-"}</td>
      <td className="num">
        <NumberInput value={quantity} onChange={onQuantityChange} allowFormula className="erp-input w-full" />
      </td>
      {dashAfterQuantity && <td className="num erp-u-muted">-</td>}
      <td className="num">{formatNumber(unitAmount)}</td>
      {dashAfterUnit && <td className="num erp-u-muted">-</td>}
      <td className="num">{formatNumber(amount)}원</td>
      <td className="num erp-u-muted">{formatNumber(calcVat(amount))}원</td>
      <td className="num">{formatNumber(amount + calcVat(amount))}원</td>
      <td className="erp-u-muted">
        {isOverridden ? `자동값 ${formatNumber(autoSheet)} → 수동 입력` : "모조지 계산 자동 반영"}
      </td>
      <td className="num">
        <button
          type="button"
          className="erp-btn erp-btn-danger erp-btn-sm erp-u-minw-0"
          onClick={onCancel}
        >
          취소
        </button>
      </td>
    </tr>
  );
}

export function PaperCalcSizeLineRows({
  lines,
  dashAfterQuantity = false,
  dashAfterUnit = false,
}: {
  lines: string[];
  dashAfterQuantity?: boolean;
  dashAfterUnit?: boolean;
}) {
  return (
    <>
      {lines.map((line, i) => (
        <tr className="erp-u-bg-bg-subtle" key={`paper-calc-size-${i}`}>
          <td className="erp-u-muted" colSpan={3} style={{ paddingLeft: 24 }}>
            ㄴ {line}
          </td>
          <td className="erp-u-muted">-</td>
          <td className="num erp-u-muted">-</td>
          {dashAfterQuantity && <td className="num erp-u-muted">-</td>}
          <td className="num erp-u-muted">-</td>
          {dashAfterUnit && <td className="num erp-u-muted">-</td>}
          <td className="num erp-u-muted">-</td>
          <td className="num erp-u-muted">-</td>
          <td className="num erp-u-muted">-</td>
          <td className="erp-u-muted">-</td>
          <td />
        </tr>
      ))}
    </>
  );
}
