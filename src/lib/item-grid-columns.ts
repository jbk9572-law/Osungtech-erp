// 매출/매입 등록 폼의 품목 그리드 칸 너비 — 두 폼이 각자 하드코딩해서
// 한쪽만 조정하면 다른 쪽엔 반영되지 않던 문제가 있었다. 이제 칸 경계를
// 마우스로 드래그해서 직접 조절할 수 있고(use-resizable-columns.ts),
// 여기 있는 값은 그 조절의 "기본값"(처음 열었을 때, 혹은 초기화했을 때)
// 이다. 기본형(수량/단가 한 쌍만 있는 매출 폼, "매출도 같이 등록" 아닌
// 매입 폼)은 이 값을 그대로 쓰고, "매출도 같이 등록"으로 열이 2개 더
// 늘어나는 매입 폼만 별도 값을 쓴다(같은 방향으로 재배분: 품목/단위
// 축소, 규격 확대).
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
  actions: 124,
} as const;
