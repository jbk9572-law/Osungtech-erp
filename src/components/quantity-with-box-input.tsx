"use client";

import { NumberInput } from "@/components/number-input";

// 품목마다 정해진 포장수량(예: 1박스=50ea)이 있으면, 수량을 직접 입력하거나
// 반대로 박스 수를 입력해서 수량을 자동으로 채울 수 있게 한다. 포장수량이
// 설정 안 된 품목은 기존처럼 수량 입력창만 보여준다.
export function QuantityWithBoxInput({
  quantity,
  onQuantityChange,
  basePackageQty,
  unit,
  allowFormula = false,
  className = "erp-input w-full",
}: {
  quantity: number;
  onQuantityChange: (n: number) => void;
  basePackageQty: number | null | undefined;
  unit?: string | null;
  allowFormula?: boolean;
  className?: string;
}) {
  return (
    <div>
      <NumberInput
        placeholder={allowFormula ? "수량 (=1+1 계산 가능)" : "수량"}
        value={quantity}
        onChange={onQuantityChange}
        allowFormula={allowFormula}
        className={className}
      />
      {basePackageQty != null && basePackageQty > 0 && (
        <div
          className="mt-1 flex items-center justify-end gap-1 text-[10.5px]"
          style={{ color: "var(--erp-text-muted)" }}
        >
          <span style={{ flexShrink: 0 }}>박스</span>
          <NumberInput
            placeholder="박스"
            value={quantity > 0 ? quantity / basePackageQty : 0}
            onChange={(box) => onQuantityChange(box * basePackageQty)}
            className="erp-input w-11 shrink-0"
          />
          <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
            × {basePackageQty.toLocaleString()}
            {unit ?? ""}
          </span>
        </div>
      )}
    </div>
  );
}
