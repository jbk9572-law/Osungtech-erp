// 견적서/구매요청서/구매견적요청서처럼 "품목·규격·수량(·단가)·비고" 한 줄짜리
// 품목 입력표를 쓰는 폼들이 각자 복붙해 갖고 있던 행 로직(빈 줄, 빈 줄 판정,
// 유효 줄 필터, 합계, 모바일 패널용 매핑)을 한 곳으로 모았다. 단가가 없는
// 폼(구매견적요청)은 unitPrice를 항상 0으로 둔다.
export type ItemEntryRow = {
  key: number;
  productId: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  remark: string;
};

export type ItemEntryProduct = { id: string; name: string; spec: string | null };

export function blankItemRow(key: number): ItemEntryRow {
  return { key, productId: "", spec: "", quantity: 0, unitPrice: 0, remark: "" };
}

export function isBlankItemRow(row: ItemEntryRow): boolean {
  return !row.productId && row.quantity === 0;
}

export function buildItemRow(
  key: number,
  product: ItemEntryProduct | undefined,
  productId: string,
  quantity: number,
  unitPrice: number,
  remark = "",
): ItemEntryRow {
  return { key, productId, spec: product?.spec ?? "", quantity, unitPrice, remark };
}

// 품목을 새로 고르면 규격은 품목 규격으로(없으면 기존 입력 유지), 단가는
// 이미 입력된 값이 있으면 유지하고 없을 때만 품목 기본 단가로 채운다.
export function applyProductToRow(
  row: ItemEntryRow,
  productId: string,
  product: ItemEntryProduct | undefined,
  defaultPrice: number,
): Partial<ItemEntryRow> {
  return {
    productId,
    spec: product?.spec ?? row.spec,
    unitPrice: row.unitPrice || defaultPrice,
  };
}

export function validItemRows(rows: ItemEntryRow[]): ItemEntryRow[] {
  return rows.filter((r) => r.productId && r.quantity > 0);
}

export function sumItemRows(rows: ItemEntryRow[]): number {
  return rows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
}

export function toMobileEntryItems(rows: ItemEntryRow[], nameOf: (productId: string) => string) {
  return rows
    .filter((r) => !isBlankItemRow(r))
    .map((r) => ({
      key: r.key,
      name: nameOf(r.productId),
      spec: r.spec,
      quantity: r.quantity,
      price: r.unitPrice,
      amount: r.quantity * r.unitPrice,
    }));
}
