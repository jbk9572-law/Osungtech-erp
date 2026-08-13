"use client";

import { NumberInput } from "@/components/number-input";

// 박스×포장수량 환산(예: 50*20)은 저장된 뒤 매출/매입 상세 페이지 목록에서만
// 보여준다(formatPackageQty 참고). 등록 화면 입력칸은 수량 하나만 받고,
// 엑셀처럼 "=10+5" 같은 수식으로 바로 계산해 넣을 수 있게 한다.
export function QuantityWithBoxInput({
  quantity,
  onQuantityChange,
  allowFormula = false,
  className = "erp-input w-full",
}: {
  quantity: number;
  onQuantityChange: (n: number) => void;
  allowFormula?: boolean;
  className?: string;
}) {
  return (
    <NumberInput
      placeholder={allowFormula ? "수량 (엑셀식 계산 가능)" : "수량"}
      value={quantity}
      onChange={onQuantityChange}
      allowFormula={allowFormula}
      className={className}
    />
  );
}
