// 매출/매입 등록 폼의 품목 그리드 칸 너비 — 두 폼이 각자 %를 따로
// 하드코딩해서 한쪽만 조정하면 다른 쪽엔 반영되지 않던 문제가 있었다.
// 기본형(수량/단가 한 쌍만 있는 매출 폼, "매출도 같이 등록" 아닌 매입
// 폼)은 이 값을 그대로 쓰고, "매출도 같이 등록"으로 열이 2개 더 늘어나는
// 매입 폼만 별도로 비율을 다시 계산한다(품목/단위를 줄이고 규격을
// 넓히고 액션 칸 여백을 줄인 같은 방향).
export const ITEM_GRID_COLUMN_WIDTHS = {
  product: "10%",
  spec: "10%",
  lotNumber: "8%",
  unit: "3%",
  quantity: "10%",
  price: "9%",
  supplyAmount: "10%",
  tax: "8%",
  total: "9%",
  remark: "15%",
  actions: "8%",
} as const;

// "매입 + 매출 동시등록" 모드는 수량/단가 칸이 2쌍(입고·출고)이라 열이
// 2개 더 많다 — 기본형과 같은 방향(품목/단위 축소, 규격 확대, 액션 칸
// 여백 축소)으로 재배분한 값.
export const ITEM_GRID_COLUMN_WIDTHS_DUAL = {
  product: "8%",
  spec: "9%",
  lotNumber: "7%",
  unit: "3%",
  quantityIn: "6%",
  quantityOut: "6%",
  priceIn: "6%",
  priceOut: "6%",
  supplyAmount: "8%",
  tax: "6%",
  total: "7%",
  remark: "15%",
  actions: "13%",
} as const;
