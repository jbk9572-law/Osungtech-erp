// 매출/매입 등록 폼의 품목 그리드 칸 너비 — 두 폼이 각자 하드코딩해서
// 한쪽만 조정하면 다른 쪽엔 반영되지 않던 문제가 있었다. 이제 칸 경계를
// 마우스로 드래그해서 직접 조절할 수 있고(use-resizable-columns.ts),
// 여기 있는 값은 그 조절의 "기본값"(처음 열었을 때, 혹은 초기화했을 때)
// 이다. 기본형(수량/단가 한 쌍만 있는 매출 폼, "매출도 같이 등록" 아닌
// 매입 폼)은 이 값을 그대로 쓰고, "매출도 같이 등록"으로 열이 2개 더
// 늘어나는 매입 폼만 별도 값을 쓴다(같은 방향으로 재배분: 품목/단위
// 축소, 규격 확대, 액션 칸 여백 축소).
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
  actions: 90,
} as const;

export const ITEM_GRID_COLUMN_PX_WIDTHS_DUAL = {
  product: 96,
  spec: 108,
  lotNumber: 84,
  unit: 40,
  quantityIn: 72,
  quantityOut: 72,
  priceIn: 72,
  priceOut: 72,
  supplyAmount: 96,
  tax: 72,
  total: 84,
  remark: 165,
  actions: 100,
} as const;
