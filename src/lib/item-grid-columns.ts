// 매출/매입 등록 폼의 품목 그리드 칸 너비 — 두 폼이 각자 하드코딩해서
// 한쪽만 조정하면 다른 쪽엔 반영되지 않던 문제가 있었다. 이제 칸 경계를
// 마우스로 드래그해서 직접 조절할 수 있고(use-resizable-columns.ts),
// 여기 있는 값은 그 조절의 "기본값"(처음 열었을 때, 혹은 초기화했을 때)
// 이다.
//
// actions: "+ 삽입"/"삭제" 버튼 두 개 + 칸 좌우 여백(.erp-grid td
// padding 10px×2)을 Playwright로 실측하면 필요한 최소 너비가 약
// 121px(버튼 두 개 100.8px + 여백 20px)이다. 예전에 여백이 남는다는
// 지적으로 90px까지 줄였다가 버튼 자체가 칸보다 넓어져서 겹쳐 보이는
// 회귀가 생겼다 — 다시 여유 있게 124px로 되돌린다.
export const ITEM_GRID_COLUMN_PX_WIDTHS = {
  product: 110,
  spec: 110,
  lotNumber: 88,
  unit: 40,
  quantity: 110,
  price: 99,
  supplyAmount: 110,
  tax: 88,
  total: 99,
  remark: 165,
  actions: 124,
} as const;

// 매입 등록 폼의 "매출도 같이 등록"(동시등록) 모드는 매입/매출 기본
// 그리드와 품목/규격/관리번호/단위/공급가액/세액/합계/비고/버튼 칸
// 구성이 완전히 같고, 수량·단가 한 쌍만 입고/출고·매입/매출 두 쌍으로
// 갈라진다 — "어차피 같은 폼"이라 저 공통 칸들까지 따로 저장하면 매출/
// 매입 쪽을 조절해도 동시등록 화면엔 반영 안 되고, 반대로 동시등록에서
// 조절해도 매출/매입 쪽엔 반영 안 되는 이중 관리가 생긴다(실사용 중
// 지적받음). 그래서 공통 칸은 아예 ITEM_GRID_COLUMN_PX_WIDTHS와 같은 DB
// 키를 그대로 쓰고(new-purchase-form.tsx의 baseCols), 여기서는 진짜로
// 갈라진 4칸의 폭만 별도로 저장한다.
export const ITEM_GRID_COLUMN_PX_WIDTHS_DUAL_SPLIT = {
  quantityIn: 72,
  quantityOut: 72,
  priceIn: 72,
  priceOut: 72,
} as const;

// 갈라진 4칸도 한 번도 조절된 적 없는 첫 화면에서는 매출/매입 쪽 수량/
// 단가 폭을 그대로 이어받게 한다 — 완전히 새로운(다른 사람이 아직 안
// 건드려본) 기본값 대신, 이미 맞춰둔 폭에서 시작하게 하기 위함이다.
export function deriveDualSplitWidths(
  baseWidths: Partial<Record<keyof typeof ITEM_GRID_COLUMN_PX_WIDTHS, number>> | null | undefined,
): Record<keyof typeof ITEM_GRID_COLUMN_PX_WIDTHS_DUAL_SPLIT, number> {
  const quantity = baseWidths?.quantity ?? ITEM_GRID_COLUMN_PX_WIDTHS.quantity;
  const price = baseWidths?.price ?? ITEM_GRID_COLUMN_PX_WIDTHS.price;
  return { quantityIn: quantity, quantityOut: quantity, priceIn: price, priceOut: price };
}
