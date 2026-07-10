// 매입처마다 실제로 쓰는 엑셀 장부 양식이 있어서, 그 업체로 다운로드할 때는
// 우리 시스템의 일반 컬럼 나열 대신 이 양식대로 셀을 그려서 내려준다.
// (참고: 업로드받은 실제 파일 구조를 그대로 재현한 것 — 품명/규격/단위/박스/
// 수량/단가/금액/비고, A1에 업체명, 5~6행에 총액/VAT, 8행에 박스·수량 합계,
// 9행이 헤더, 10행부터 데이터.)

export type LedgerItem = {
  date: string; // YYYY-MM-DD
  productName: string;
  spec: string;
  unit: string;
  quantity: number;
  unitCost: number;
  basePackageQty: number | null;
};

type AoaRow = (string | number | null)[];

function monthLabelOf(month: number): string {
  return `${month}월`;
}

export function buildStandardLedgerSheet(
  vendorName: string,
  year: number,
  month: number,
  items: LedgerItem[],
  priceBasis: "box" | "quantity"
): AoaRow[] {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

  let totalAmount = 0;
  let totalBox = 0;
  let totalQty = 0;
  const dataRows: AoaRow[] = [];
  let lastDate = "";

  for (const item of sorted) {
    const box = item.basePackageQty ? item.quantity / item.basePackageQty : null;
    const amount =
      priceBasis === "box" ? (box ?? item.quantity) * item.unitCost : item.quantity * item.unitCost;
    totalAmount += amount;
    totalBox += box ?? 0;
    totalQty += item.quantity;

    dataRows.push([
      item.date === lastDate ? null : item.date,
      item.productName,
      item.spec || null,
      item.unit || null,
      box !== null ? Number(box.toFixed(2)) : null,
      item.quantity,
      item.unitCost,
      Math.round(amount),
      null,
    ]);
    lastDate = item.date;
  }

  const rows: AoaRow[] = [];
  rows.push([vendorName, null, null, null, null, null, null, null, monthLabelOf(month)]); // 1행
  rows.push([]); // 2행
  rows.push([null, null, null, null, null, null, null, null, year]); // 3행
  rows.push([]); // 4행
  rows.push(["총액", Math.round(totalAmount)]); // 5행
  rows.push(["VAT 합계", Math.round(totalAmount * 1.1)]); // 6행
  rows.push([]); // 7행
  rows.push(["매입내역", null, null, null, Number(totalBox.toFixed(2)), totalQty]); // 8행
  rows.push([null, "품명", "규격", "단위", "박스", "수량", "단가", "금액", "비고"]); // 9행
  rows.push(...dataRows);

  return rows;
}

// 리더스특수지: 실제 원본은 품목군 2개를 나란히 두고 무게까지 추적하는 훨씬
// 복잡한 자체 양식이지만, 우리 시스템엔 무게·품목군 구분 데이터가 없어 그대로
// 재현할 수 없다. 일자/품명/규격/수량/단가/금액/비고로 단순화한 표로 대신한다.
export function buildLeadersSpecialSheet(vendorName: string, year: number, month: number, items: LedgerItem[]): AoaRow[] {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

  let totalAmount = 0;
  const dataRows: AoaRow[] = [];
  let lastDate = "";

  for (const item of sorted) {
    const amount = item.quantity * item.unitCost;
    totalAmount += amount;
    dataRows.push([
      item.date === lastDate ? null : item.date,
      item.productName,
      item.spec || null,
      item.quantity,
      item.unitCost,
      Math.round(amount),
      null,
    ]);
    lastDate = item.date;
  }

  const rows: AoaRow[] = [];
  rows.push([vendorName, null, null, null, null, monthLabelOf(month)]); // 1행
  rows.push([]); // 2행
  rows.push([null, null, null, null, null, year]); // 3행
  rows.push([]); // 4행
  rows.push(["총액", Math.round(totalAmount)]); // 5행
  rows.push(["VAT 합계", Math.round(totalAmount * 1.1)]); // 6행
  rows.push([]); // 7행
  rows.push(["일자", "품명", "규격", "수량", "단가", "금액", "비고"]); // 8행
  rows.push(...dataRows);

  return rows;
}
