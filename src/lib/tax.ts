// 부가세(VAT) 10% 계산 — 매출/매입 등록·상세·인쇄·리포트·엑셀내보내기 등
// 10곳 넘게 각자 Math.round(공급가액 * 0.1)을 복붙해서 갖고 있던 걸 하나로
// 뺐다. 세율이나 반올림 방식이 바뀌면 여기 한 곳만 고치면 된다.
export const VAT_RATE = 0.1;

export function calcVat(supplyAmount: number): number {
  return Math.round(supplyAmount * VAT_RATE);
}
