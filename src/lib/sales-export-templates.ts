import ExcelJS from "exceljs";

// 매출처마다 실제로 쓰는 엑셀 명세표 양식이 있어서, 그 거래처로 다운로드할 때는
// 우리 시스템의 일반 컬럼 나열 대신 이 양식대로(수신/발신·합계금액 한글표기
// (NUMBERSTRING)·전체금액/전체세액·세액 수식까지) 셀을 그려서 내려준다.
// 업로드받은 실제 파일들을 셀 단위로 확인한 결과 3가지 변형이 있었다:
// - filter_box: 박스 단위가 있는 필터부품형 (일자/품명/규격/단위/박스/수량/단가/공급가액/세액/비고)
// - filter_no_box: 박스 단위가 없는 필터부품형 (일자/품명/규격/단위/수량/단가/공급가액/세액/비고)
// - paper_roll: 지류(종이)형, 원본은 무게(Box)×무게(합산) 컬럼이 있지만 우리
//   시스템엔 롤 무게 데이터가 없어서 그 두 컬럼은 비워두고 수량×단가로 계산한다.
//
// 원본 파일들은 매달 32행 안팎의 고정 범위에 SUMIFS/SUM을 걸어뒀지만, 여기서는
// 매입 쪽 양식과 마찬가지로 실제 품목 수만큼만 행을 만들고 그 범위로 합계
// 수식을 건다(매달 품목 수가 달라도 항상 맞게 계산되도록).

export type StatementItem = {
  date: string; // YYYY-MM-DD
  productName: string;
  spec: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  basePackageQty: number | null;
};

const WON_FORMAT = '_-"₩"* #,##0_-;-"₩"* #,##0_-;_-"₩"* "-"_-;_-@_-';
const NUM_FORMAT = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-';
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };

function formatDateRange(from: string, to: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${y}년${m}월${d}일`;
  };
  return `${fmt(from)} ~ ${fmt(to)}`;
}

function headerBorder(): Partial<ExcelJS.Borders> {
  return { top: { style: "thin" }, bottom: { style: "double" } };
}

// 1~11행 공통 헤더(회사명/거래일자/수신·발신/합계금액/전체금액·전체세액/컬럼헤더)를 그린다.
// lastCol: 표 전체 폭(마지막 컬럼 번호). totalsLabelCol/totalsValueCol: 우측의
// "전체금액/전체세액" 라벨·값이 들어갈 위치. valueMergeEndCol: 값 칸을 그 오른쪽으로
// 더 합칠 때(지류형은 J:K 병합) 쓴다. supplyTotalCol/taxTotalCol: 합계행에서 공급가액·
// 세액 합계가 있는 컬럼(전체금액/전체세액 수식이 참조한다).
function drawHeader(
  sheet: ExcelJS.Worksheet,
  opts: {
    customerName: string;
    companyName: string;
    from: string;
    to: string;
    lastCol: number;
    wordsMergeEndCol: number;
    totalsLabelCol: number;
    totalsValueCol: number;
    valueMergeEndCol?: number;
    supplyTotalCol: number;
    taxTotalCol: number;
    totalRow: number;
    headers: string[];
  }
) {
  const {
    customerName,
    companyName,
    from,
    to,
    lastCol,
    wordsMergeEndCol,
    totalsLabelCol,
    totalsValueCol,
    valueMergeEndCol,
    supplyTotalCol,
    taxTotalCol,
    totalRow,
    headers,
  } = opts;

  sheet.mergeCells(1, 1, 1, lastCol);
  const nameCell = sheet.getCell(1, 1);
  nameCell.value = customerName;
  nameCell.font = { bold: true, size: 22 };
  nameCell.alignment = { horizontal: "center", vertical: "middle" };

  sheet.getCell(3, 1).value = `거래일자 : ${formatDateRange(from, to)}`;

  sheet.getCell(5, 1).value = "수  신   :";
  sheet.getCell(5, 2).value = customerName;
  sheet.getCell(7, 1).value = "발  신   :";
  sheet.getCell(7, 2).value = companyName;

  sheet.mergeCells(9, 1, 10, 1);
  sheet.mergeCells(9, 2, 10, wordsMergeEndCol);
  const totalLabelCell = sheet.getCell(9, 1);
  totalLabelCell.value = "  합계금액 : ";

  const totalCellRef = sheet.getCell(totalRow, 2).address;
  const wordsFormula = `NUMBERSTRING(${totalCellRef},1)&"원정 (\\"&TEXT(${totalCellRef},"#,###")&".-)"`;
  const wordsCell = sheet.getCell(9, 2);
  wordsCell.value = { formula: wordsFormula };

  if (valueMergeEndCol) {
    sheet.mergeCells(9, totalsValueCol, 9, valueMergeEndCol);
    sheet.mergeCells(10, totalsValueCol, 10, valueMergeEndCol);
  }

  sheet.getCell(9, totalsLabelCol).value = "전체금액";
  const amountValueCell = sheet.getCell(9, totalsValueCol);
  amountValueCell.value = { formula: sheet.getCell(totalRow, supplyTotalCol).address };
  amountValueCell.numFmt = NUM_FORMAT;

  sheet.getCell(10, totalsLabelCol).value = "전체세액";
  const taxValueCell = sheet.getCell(10, totalsValueCol);
  taxValueCell.value = { formula: sheet.getCell(totalRow, taxTotalCol).address };
  taxValueCell.numFmt = NUM_FORMAT;

  headers.forEach((label, i) => {
    const cell = sheet.getCell(11, i + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center" };
    cell.fill = HEADER_FILL;
    cell.border = headerBorder();
  });
}

function writeDate(cell: ExcelJS.Cell, iso: string, lastDate: string): string {
  if (iso !== lastDate) {
    cell.value = new Date(`${iso}T00:00:00`);
    cell.numFmt = 'mm"월" dd"일"';
  }
  return iso;
}

export async function buildFilterBoxStatementWorkbook(
  customerName: string,
  companyName: string,
  from: string,
  to: string,
  items: StatementItem[]
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(customerName.slice(0, 28));

  sheet.columns = [
    { width: 10 }, { width: 18 }, { width: 12 }, { width: 8 },
    { width: 8 }, { width: 9 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 16 },
  ];

  const totalRow = 12 + items.length;
  drawHeader(sheet, {
    customerName,
    companyName,
    from,
    to,
    lastCol: 10,
    wordsMergeEndCol: 6,
    totalsLabelCol: 9,
    totalsValueCol: 10,
    supplyTotalCol: 8,
    taxTotalCol: 9,
    totalRow,
    headers: ["일자", "품명", "규격", "단위", "박스", "수량", "단가", "공급가액", "세액", "비고"],
  });

  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  let lastDate = "";
  sorted.forEach((item, idx) => {
    const r = 12 + idx;
    lastDate = writeDate(sheet.getCell(r, 1), item.date, lastDate);
    sheet.getCell(r, 2).value = item.productName;
    sheet.getCell(r, 3).value = item.spec || null;
    sheet.getCell(r, 4).value = item.unit || null;
    const box = item.basePackageQty ? item.quantity / item.basePackageQty : item.quantity;
    const boxCell = sheet.getCell(r, 5);
    boxCell.value = Number(box.toFixed(2));
    boxCell.numFmt = NUM_FORMAT;
    const qtyCell = sheet.getCell(r, 6);
    qtyCell.value = item.quantity;
    qtyCell.numFmt = NUM_FORMAT;
    const priceCell = sheet.getCell(r, 7);
    priceCell.value = item.unitPrice;
    priceCell.numFmt = NUM_FORMAT;
    const amountCell = sheet.getCell(r, 8);
    amountCell.value = { formula: `F${r}*G${r}` };
    amountCell.numFmt = NUM_FORMAT;
    const taxCell = sheet.getCell(r, 9);
    taxCell.value = { formula: `H${r}*0.1` };
    taxCell.numFmt = NUM_FORMAT;
  });

  sheet.getCell(totalRow, 1).value = "합계";
  sheet.getCell(totalRow, 1).font = { bold: true };
  const supplyTotal = sheet.getCell(totalRow, 8);
  supplyTotal.value = { formula: `SUM(H12:H${totalRow - 1})` };
  supplyTotal.numFmt = NUM_FORMAT;
  const taxTotal = sheet.getCell(totalRow, 9);
  taxTotal.value = { formula: `SUM(I12:I${totalRow - 1})` };
  taxTotal.numFmt = NUM_FORMAT;
  const grandTotal = sheet.getCell(totalRow, 2);
  grandTotal.value = { formula: `SUM(H${totalRow}:I${totalRow})` };
  grandTotal.numFmt = WON_FORMAT;
  grandTotal.font = { bold: true };

  return workbook;
}

export async function buildFilterNoBoxStatementWorkbook(
  customerName: string,
  companyName: string,
  from: string,
  to: string,
  items: StatementItem[]
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(customerName.slice(0, 28));

  sheet.columns = [
    { width: 10 }, { width: 18 }, { width: 12 }, { width: 8 },
    { width: 9 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 16 },
  ];

  const totalRow = 12 + items.length;
  drawHeader(sheet, {
    customerName,
    companyName,
    from,
    to,
    lastCol: 9,
    wordsMergeEndCol: 6,
    totalsLabelCol: 8,
    totalsValueCol: 9,
    supplyTotalCol: 7,
    taxTotalCol: 8,
    totalRow,
    headers: ["일자", "품명", "규격", "단위", "수량", "단가", "공급가액", "세액", "비고"],
  });

  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  let lastDate = "";
  sorted.forEach((item, idx) => {
    const r = 12 + idx;
    lastDate = writeDate(sheet.getCell(r, 1), item.date, lastDate);
    sheet.getCell(r, 2).value = item.productName;
    sheet.getCell(r, 3).value = item.spec || null;
    sheet.getCell(r, 4).value = item.unit || null;
    const qtyCell = sheet.getCell(r, 5);
    qtyCell.value = item.quantity;
    qtyCell.numFmt = NUM_FORMAT;
    const priceCell = sheet.getCell(r, 6);
    priceCell.value = item.unitPrice;
    priceCell.numFmt = NUM_FORMAT;
    const amountCell = sheet.getCell(r, 7);
    amountCell.value = { formula: `E${r}*F${r}` };
    amountCell.numFmt = NUM_FORMAT;
    const taxCell = sheet.getCell(r, 8);
    taxCell.value = { formula: `G${r}*0.1` };
    taxCell.numFmt = NUM_FORMAT;
  });

  sheet.getCell(totalRow, 1).value = "합계";
  sheet.getCell(totalRow, 1).font = { bold: true };
  const supplyTotal = sheet.getCell(totalRow, 7);
  supplyTotal.value = { formula: `SUM(G12:G${totalRow - 1})` };
  supplyTotal.numFmt = NUM_FORMAT;
  const taxTotal = sheet.getCell(totalRow, 8);
  taxTotal.value = { formula: `SUM(H12:H${totalRow - 1})` };
  taxTotal.numFmt = NUM_FORMAT;
  const grandTotal = sheet.getCell(totalRow, 2);
  grandTotal.value = { formula: `G${totalRow}+H${totalRow}` };
  grandTotal.numFmt = WON_FORMAT;
  grandTotal.font = { bold: true };

  return workbook;
}

// 지류(종이)형: 원본은 롤수(Box)/무게(Box)/무게(합산) 컬럼으로 무게 기준
// 단가를 매기지만, 우리 시스템엔 롤 무게 데이터가 없어 그 세 컬럼은 비워
// 두고 금액은 수량×단가로 계산한다(다른 거래처와 동일한 방식).
export async function buildPaperRollStatementWorkbook(
  customerName: string,
  companyName: string,
  from: string,
  to: string,
  items: StatementItem[]
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(customerName.slice(0, 28));

  sheet.columns = [
    { width: 10 }, { width: 18 }, { width: 12 }, { width: 9 },
    { width: 9 }, { width: 9 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 16 },
  ];

  const totalRow = 12 + items.length;
  drawHeader(sheet, {
    customerName,
    companyName,
    from,
    to,
    lastCol: 11,
    wordsMergeEndCol: 7,
    totalsLabelCol: 9,
    totalsValueCol: 10,
    valueMergeEndCol: 11,
    supplyTotalCol: 9,
    taxTotalCol: 10,
    totalRow,
    headers: ["일자", "품명", "규격", "롤수(Box)", "수량(Box)", "무게(Box)", "무게(합산)", "단가", "금액", "세액", "비고"],
  });

  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  let lastDate = "";
  sorted.forEach((item, idx) => {
    const r = 12 + idx;
    lastDate = writeDate(sheet.getCell(r, 1), item.date, lastDate);
    sheet.getCell(r, 2).value = item.productName;
    sheet.getCell(r, 3).value = item.spec || null;
    // 롤수(D)/수량(E)/무게(F)은 우리 시스템에 데이터가 없어 비워둔다. 우리가
    // 저장하는 quantity는 원본 파일의 "무게(합산)"(G, 실제 판매 단가를
    // 곱하는 기준 수량)에 해당하는 값이라 G에 넣는다.
    const weightCell = sheet.getCell(r, 7);
    weightCell.value = item.quantity;
    weightCell.numFmt = NUM_FORMAT;
    const priceCell = sheet.getCell(r, 8);
    priceCell.value = item.unitPrice;
    priceCell.numFmt = NUM_FORMAT;
    const amountCell = sheet.getCell(r, 9);
    amountCell.value = { formula: `G${r}*H${r}` };
    amountCell.numFmt = NUM_FORMAT;
    const taxCell = sheet.getCell(r, 10);
    taxCell.value = { formula: `I${r}*0.1` };
    taxCell.numFmt = NUM_FORMAT;
  });

  sheet.getCell(totalRow, 1).value = "합계";
  sheet.getCell(totalRow, 1).font = { bold: true };
  const amountTotal = sheet.getCell(totalRow, 9);
  amountTotal.value = { formula: `SUM(I12:I${totalRow - 1})` };
  amountTotal.numFmt = NUM_FORMAT;
  const taxTotal = sheet.getCell(totalRow, 10);
  taxTotal.value = { formula: `SUM(J12:J${totalRow - 1})` };
  taxTotal.numFmt = NUM_FORMAT;
  const grandTotal = sheet.getCell(totalRow, 2);
  grandTotal.value = { formula: `SUM(I${totalRow}+J${totalRow})` };
  grandTotal.numFmt = WON_FORMAT;
  grandTotal.font = { bold: true };

  return workbook;
}
