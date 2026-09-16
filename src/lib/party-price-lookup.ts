// 거래처(판매단가)/공급처(매입단가) 조합 조회 — new-sale-form.tsx와
// new-purchase-form.tsx가 필드명만 다를 뿐(customer_id/unit_price vs
// supplier_id/unit_cost) 완전히 똑같은 "partyId:productId 키로 맵을
// 만들고 조회한다" 로직을 각자 복붙해서 갖고 있던 것을 공용 함수로 뺐다.

export function buildPartyProductMap<T>(
  rows: T[],
  partyIdOf: (row: T) => string,
  productIdOf: (row: T) => string,
  valueOf: (row: T) => number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(`${partyIdOf(row)}:${productIdOf(row)}`, valueOf(row));
  }
  return map;
}

export function buildPartyProductNoteMap<T>(
  rows: T[],
  partyIdOf: (row: T) => string,
  productIdOf: (row: T) => string,
  noteOf: (row: T) => string | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const note = noteOf(row);
    if (note) map.set(`${partyIdOf(row)}:${productIdOf(row)}`, note);
  }
  return map;
}

export function lookupPartyProductValue<V>(
  map: Map<string, V>,
  partyId: string,
  productId: string,
): V | undefined {
  return map.get(`${partyId}:${productId}`);
}

// 케이아이티솔루션·제니스테크·타이거일렉처럼 같은 거래처/공급처+품목
// 조합에 매번 같은 관리번호를 써온 경우, 지난번 값을 다시 찾아 입력할
// 필요 없게 가장 최근 값을 그대로 이어서 채운다 — 날짜 내림차순으로
// 정렬해 첫 번째 항목을 쓴다.
export function getMostRecentLotNumber<T>(
  history: T[],
  matches: (row: T) => boolean,
  dateOf: (row: T) => string,
  lotOf: (row: T) => string | null | undefined,
): string | null {
  const entries = history
    .filter((row) => matches(row) && lotOf(row))
    .sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : -1));
  return entries.length ? (lotOf(entries[0]) ?? null) : null;
}
