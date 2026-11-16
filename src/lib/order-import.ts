// 할일 등록 화면의 "매입에서 불러오기 / 매출에서 불러오기"가 쓰는 공용 모양 — 매입 품목과 매출 품목을 같은 형태로 다룬다.
export type ImportableOrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  sku: string;
  spec: string;
  quantity: number;
  unit: string;
  lotNumber: string;
  partnerId: string;
  partnerName: string;
};

export type ImportableOrder = {
  orderId: string;
  partnerId: string;
  partnerName: string;
  items: ImportableOrderItem[];
};

// 품목 줄 목록을 거래(전표) 단위로 묶는다 — 한 번 눌러서 그 거래의 품목을 전부 불러오기 위해서.
export function groupByOrder(items: ImportableOrderItem[]): ImportableOrder[] {
  const map = new Map<string, ImportableOrder>();
  for (const item of items) {
    const found = map.get(item.orderId);
    if (found) found.items.push(item);
    else map.set(item.orderId, { orderId: item.orderId, partnerId: item.partnerId, partnerName: item.partnerName, items: [item] });
  }
  return [...map.values()];
}
