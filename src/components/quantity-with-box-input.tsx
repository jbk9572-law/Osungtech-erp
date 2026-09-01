"use client";

import { NumberInput } from "@/components/number-input";

// 박스×포장수량 환산(예: 50*20)은 저장된 뒤 매출/매입 상세 페이지 목록에서만
// 보여준다(formatPackageQty 참고). 등록 화면 입력칸은 수량 하나만 받고,
// 엑셀처럼 "=10+5" 같은 수식으로 바로 계산해 넣을 수 있게 한다.
//
// 박스당수량(basePackageQty)이 등록된 품목이면, 빈 칸일 때 뜨는 placeholder를
// "수량 (예: 30×1=30)"처럼 그 품목 기준 1박스 예시로 바꿔서, 입력 전에
// 박스당 몇 개인지 바로 감이 오게 한다. placeholder라 입력을 시작하면
// 사라지고 그 전까지는 값이 얼마든 항상 "×1" 고정 예시로만 보여준다.
export function QuantityWithBoxInput({
  quantity,
  onQuantityChange,
  allowFormula = false,
  basePackageQty,
  label = "수량",
  className = "erp-input w-full",
}: {
  quantity: number;
  onQuantityChange: (n: number) => void;
  allowFormula?: boolean;
  basePackageQty?: number | string | null;
  // 출고수량처럼 "수량"이 아닌 다른 이름이 필요한 자리에서 바꿔 쓴다.
  label?: string;
  className?: string;
}) {
  const base = basePackageQty != null ? Number(basePackageQty) : null;
  const placeholder =
    base && base > 0
      ? `${label} (예: ${base.toLocaleString()}×1=${base.toLocaleString()})`
      : allowFormula
        ? `${label} (엑셀식 계산 가능)`
        : label;

  return (
    <NumberInput
      placeholder={placeholder}
      value={quantity}
      onChange={onQuantityChange}
      allowFormula={allowFormula}
      className={className}
    />
  );
}
