// 계산식으로 입력한 값(수량·단가) 옆의 "fx" 표시 — 마우스를 올리면 입력한 식이 나온다(저장된 식, lib/item-formulas).
// 입력자가 계산을 잘못했을 때 식을 보고 알아채게 하는 용도다. 표시 여부는 테마 토큰(--erp-fx-badge-display, 클래식 숨김).
export function FormulaMark({ formula, value }: { formula: string | null | undefined; value: string }) {
  if (!formula) return null;
  return (
    <span className="erp-fx-mark" title={`계산식 ${formula} → ${value}`}>
      fx
    </span>
  );
}
