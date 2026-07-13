// 모조지 계산 결과(input_items: 주문 품목 규격별 수량)를 "가로×세로 : 수량"
// 줄 목록으로 바꾼다. 매출/매입 상세, 대시보드 오늘의 업무 등 여러 화면에서
// 같은 형식을 써서 서로 다르게 보이지 않게 한다.
export type PaperCalcSizeRow = { width: number; height: number; qty: number };

export function formatPaperCalcSizeLines(sizes: PaperCalcSizeRow[]): string[] {
  return sizes.map((s) => `${s.width}×${s.height} : ${s.qty.toLocaleString()}`);
}

// paper_calculations.input_items(jsonb)는 {name, width, height, orderQty}[] 형태다.
// 여러 계산을 합칠 때(같은 날짜에 계산이 여러 건이거나, 판매/매입 계산을
// 같이 보여줄 때) 같은 규격은 수량을 더한다.
export function mergePaperCalcInputItems(
  sizes: PaperCalcSizeRow[],
  inputItems: unknown
): PaperCalcSizeRow[] {
  if (!Array.isArray(inputItems)) return sizes;
  const next = [...sizes];
  for (const raw of inputItems) {
    const item = raw as { width?: number; height?: number; orderQty?: number };
    if (!item.width || !item.height || !item.orderQty) continue;
    const existing = next.find((s) => s.width === item.width && s.height === item.height);
    if (existing) existing.qty += item.orderQty;
    else next.push({ width: item.width, height: item.height, qty: item.orderQty });
  }
  return next;
}
