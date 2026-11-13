// 부가세(VAT) 10% 계산 — 매출/매입 등록·상세·인쇄·리포트·엑셀내보내기 등
// 10곳 넘게 각자 Math.round(공급가액 * 0.1)을 복붙해서 갖고 있던 걸 하나로
// 뺐다. 세율이나 반올림 방식이 바뀌면 여기 한 곳만 고치면 된다.
export const VAT_RATE = 0.1;

// 반올림은 0에서 먼 쪽으로(원 단위 반올림) 하되 부호와 무관하게 대칭이다 — Math.round(-2.5)는
// -2라서 원본(+3)과 취소분(-2)의 세액이 1원 어긋났다(수정세금계산서·반품 엑셀).
export function calcVat(supplyAmount: number): number {
  const vat = Math.round(Math.abs(supplyAmount) * VAT_RATE);
  return supplyAmount < 0 ? -vat : vat;
}

// 과세구분별 세액 — 면세/영세는 세액 0이다. 목록·상세·인쇄·엑셀·세금계산서가 같은 규칙을
// 쓰도록 이 함수만 쓴다(예전에는 목록은 과세만 계산하고 상세/인쇄/엑셀은 전부 10%를 붙였다).
export function calcVatForTaxType(supplyAmount: number, taxType: string | null | undefined): number {
  return taxType === "과세" ? calcVat(supplyAmount) : 0;
}
