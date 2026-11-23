"use client";

import { NumberInput } from "@/components/number-input";
import { QtyWithBoxes } from "@/components/qty-with-boxes";
import { formatNumber } from "@/lib/format-number";

// 박스×포장수량 환산(예: 50*20)은 저장된 뒤 매출/매입 상세 페이지 목록에서만
// 보여준다(formatPackageQty 참고). 등록 화면 입력칸은 수량 하나만 받고,
// 엑셀처럼 "=10+5" 같은 수식으로 바로 계산해 넣을 수 있게 한다.
//
// 박스당수량(basePackageQty)이 등록된 품목이면, 빈 칸일 때 뜨는 placeholder를
// "수량 (예: 30×1=30)"처럼 그 품목 기준 1박스 예시로 바꿔서, 입력 전에
// 박스당 몇 개인지 바로 감이 오게 한다. placeholder라 입력을 시작하면
// 사라지고 그 전까지는 값이 얼마든 항상 "×1" 고정 예시로만 보여준다.
//
// 입력을 시작한 뒤에는(예: 500) 그 숫자만 덩그러니 있어서 몇 박스인지
// 바로 감이 안 온다는 지적 — 재고실사 화면(inventory-count-form.tsx)에서
// 먼저 만든 것과 같은 방식으로, 값이 있을 때도 그 아래에 작게 박스
// 환산을 실시간으로 보여준다. 이 컴포넌트를 쓰는 모든 화면(매출/매입/
// 할일 등록)이 한 번에 같이 좋아지도록 여기(공용 컴포넌트)에서 고친다.
export function QuantityWithBoxInput({
  quantity,
  onQuantityChange,
  allowFormula = false,
  formula,
  onFormulaChange,
  basePackageQty,
  unit,
  label = "수량",
  className = "erp-input w-full",
  id,
}: {
  quantity: number;
  onQuantityChange: (n: number) => void;
  allowFormula?: boolean;
  // 계산식 저장·표시(NumberInput 참고) — 넘기지 않으면 식은 저장하지 않는다.
  formula?: string | null;
  onFormulaChange?: (formula: string | null) => void;
  basePackageQty?: number | string | null;
  // 품목 단위 — 리터 계열이면 환산 표시가 "박스"가 아니라 "포"로 나온다.
  unit?: string | null;
  // 출고수량처럼 "수량"이 아닌 다른 이름이 필요한 자리에서 바꿔 쓴다.
  label?: string;
  className?: string;
  id?: string;
}) {
  const base = basePackageQty != null ? Number(basePackageQty) : null;
  // 칸 안 안내 글자는 두지 않는다(좁은 칸에서 잘림) — 수식 안내는 title로만 알린다.
  const placeholder = label;
  const hint = allowFormula ? "12*3처럼 계산식을 입력할 수 있습니다" : undefined;

  return (
    <div>
      <NumberInput
        id={id}
        title={hint}
        placeholder={placeholder}
        value={quantity}
        onChange={onQuantityChange}
        allowFormula={allowFormula}
        formula={formula}
        onFormulaChange={onFormulaChange}
        className={className}
      />
      {base !== null && base > 0 && quantity !== 0 && (
        <div className="mt-0.5 text-[10px] erp-u-muted">
          <QtyWithBoxes quantity={quantity} basePackageQty={base} packUnit={unit} />
        </div>
      )}
    </div>
  );
}
