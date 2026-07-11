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
// 원본 파일은 순수 회색 hex가 아니라 테마색(테마 0=배경색)에 살짝 어두운
// tint를 준 채우기라 셀 단위로 뜯어보니 매번 이 값이었다.
// exceljs의 Color 타입 선언에는 tint가 빠져 있지만 런타임 xlsx 작성기는
// theme+tint 조합을 그대로 지원한다(color-xform.js 참고).
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { theme: 0, tint: -0.0499893185216834 } as unknown as ExcelJS.Color,
};

function formatDateRange(from: string, to: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${y}년${m}월${d}일`;
  };
  return `${fmt(from)} ~ ${fmt(to)}`;
}

// 컬럼 헤더 행(11행) 테두리: 위쪽 실선/아래쪽 이중선은 전 컬럼 공통이고,
// 좌우는 표 바깥쪽 테두리(진짜 왼쪽 끝/오른쪽 끝)만 실선, 안쪽은 실선보다
// 얇은 hair로 그린다(데이터 행의 applyRowBorder와 같은 규칙).
function headerCellBorder(col: number, lastCol: number): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin" },
    bottom: { style: "double" },
    left: { style: col === 1 ? "thin" : "hair" },
    right: { style: col === lastCol ? "thin" : "hair" },
  };
}

// 1~10행(제목 아래 ~ 합계금액 박스)도 원본은 왼쪽/오른쪽 끝에 실선 테두리가
// 쳐진 하나의 박스 모양이고, 거래일자 줄(3행) 밑과 합계금액 박스(9~10행)
// 위/아래에도 실선이 그어져 있다. 값 채우기와 별개로 이 테두리만 한 번에 그린다.
function applyHeaderBoxBorder(
  sheet: ExcelJS.Worksheet,
  row: number,
  lastCol: number,
  extra?: Partial<ExcelJS.Borders>
) {
  for (let c = 1; c <= lastCol; c++) {
    const cell = sheet.getCell(row, c);
    cell.border = {
      ...extra,
      left: c === 1 ? { style: "thin" } : undefined,
      right: c === lastCol ? { style: "thin" } : undefined,
    };
  }
}

// 데이터 행 전체에 가는 격자 테두리를 그린다(원본 파일들이 다 이런 표
// 모양이었는데, 값/수식만 채우고 테두리는 안 그려서 빠져 있었다).
// centerCols: 가운데 정렬할 컬럼 번호만 지정(예: 지류형은 일자/품명/규격/비고만
// 가운데 정렬이고 나머지 숫자 컬럼은 기본 정렬). 생략하면 전 컬럼 가운데 정렬
// (필터형 원본이 그렇게 되어 있었다).
function applyRowBorder(sheet: ExcelJS.Worksheet, row: number, lastCol: number, centerCols?: number[]) {
  for (let c = 1; c <= lastCol; c++) {
    const cell = sheet.getCell(row, c);
    const shouldCenter = centerCols ? centerCols.includes(c) : true;
    cell.alignment = shouldCenter ? { horizontal: "center", vertical: "middle" } : { vertical: "middle" };
    cell.border = {
      top: { style: "hair" },
      bottom: { style: "hair" },
      left: { style: c === 1 ? "thin" : "hair" },
      right: { style: c === lastCol ? "thin" : "hair" },
    };
  }
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
  sheet.getCell(5, 1).alignment = { horizontal: "right", vertical: "middle" };
  sheet.getCell(5, 2).value = customerName;
  sheet.getCell(7, 1).value = "발  신   :";
  sheet.getCell(7, 1).alignment = { horizontal: "right", vertical: "middle" };
  sheet.getCell(7, 2).value = companyName;

  // 1행은 lastCol까지 통째로 병합된 한 셀이라, exceljs에서는 병합된 셀들이
  // 전부 같은 style 객체를 공유한다(merge()가 style 참조를 그대로 복사).
  // 컬럼별로 나눠서 border를 따로 지정하면 나중 호출이 앞 호출을 덮어써
  // 버리므로, 병합 범위는 항상 한 번에 최종 모양을 지정해야 한다.
  nameCell.border = { left: { style: "thin" }, right: { style: "thin" }, top: { style: "thin" } };
  for (let r = 2; r <= 8; r++) {
    applyHeaderBoxBorder(sheet, r, lastCol, r === 3 ? { bottom: { style: "thin" } } : undefined);
  }

  sheet.mergeCells(9, 1, 10, 1);
  sheet.mergeCells(9, 2, 10, wordsMergeEndCol);
  const totalLabelCell = sheet.getCell(9, 1);
  totalLabelCell.value = "  합계금액 : ";
  totalLabelCell.alignment = { horizontal: "center", vertical: "middle" };
  // 위 1행과 같은 이유로, 9~10행에 걸쳐 세로 병합된 라벨 칸(1열)과 한글금액
  // 칸(2~wordsMergeEndCol열)은 위/아래 테두리를 각각 한 번에 같이 지정한다.
  totalLabelCell.border = {
    left: { style: "thin" },
    top: { style: "thin" },
    bottom: { style: "thin" },
  };
  sheet.getCell(9, 2).border = { top: { style: "thin" }, bottom: { style: "thin" } };

  // valueMergeEndCol 병합은 border를 채우기 전에 먼저 해둬야 한다 - merge()가
  // 슬레이브 셀의 style을 마스터 style로 통째로 덮어써서, 병합을 나중에 하면
  // 방금 지정한 border가 사라진다.
  if (valueMergeEndCol) {
    sheet.mergeCells(9, totalsValueCol, 9, valueMergeEndCol);
    sheet.mergeCells(10, totalsValueCol, 10, valueMergeEndCol);
  }

  // wordsMergeEndCol 다음 칸부터는 9행·10행이 따로따로인 셀(또는 그 안에서만
  // 가로 병합)이라 행별로 나눠 지정해도 안전하다.
  for (let c = wordsMergeEndCol + 1; c <= lastCol; c++) {
    sheet.getCell(9, c).border = {
      top: { style: "thin" },
      right: c === lastCol ? { style: "thin" } : undefined,
    };
    sheet.getCell(10, c).border = {
      bottom: { style: "thin" },
      right: c === lastCol ? { style: "thin" } : undefined,
    };
  }

  const totalCellRef = sheet.getCell(totalRow, 2).address;
  const wordsFormula = `NUMBERSTRING(${totalCellRef},1)&"원정 (\\"&TEXT(${totalCellRef},"#,###")&".-)"`;
  const wordsCell = sheet.getCell(9, 2);
  wordsCell.value = { formula: wordsFormula };

  sheet.getCell(9, totalsLabelCol).value = "전체금액";
  const amountValueCell = sheet.getCell(9, totalsValueCol);
  amountValueCell.value = { formula: sheet.getCell(totalRow, supplyTotalCol).address };
  amountValueCell.numFmt = NUM_FORMAT;

  sheet.getCell(10, totalsLabelCol).value = "전체세액";
  const taxValueCell = sheet.getCell(10, totalsValueCol);
  taxValueCell.value = { formula: sheet.getCell(totalRow, taxTotalCol).address };
  taxValueCell.numFmt = NUM_FORMAT;

  headers.forEach((label, i) => {
    const col = i + 1;
    const cell = sheet.getCell(11, col);
    cell.value = label;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = HEADER_FILL;
    cell.border = headerCellBorder(col, lastCol);
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
    applyRowBorder(sheet, r, 10);
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
  applyRowBorder(sheet, totalRow, 10);

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
    applyRowBorder(sheet, r, 9);
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
  applyRowBorder(sheet, totalRow, 9);

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
    // 곱하는 기준 수량)에 해당하는 값이라 G에 넣는다. 원본 파일은 이 두 컬럼을
    // 값이 있든 없든 빨간 글자색으로 강조해뒀어서 그대로 맞춘다.
    const boxQtyCell = sheet.getCell(r, 5);
    boxQtyCell.font = { color: { argb: "FFFF0000" } };
    const weightCell = sheet.getCell(r, 7);
    weightCell.value = item.quantity;
    weightCell.numFmt = NUM_FORMAT;
    weightCell.font = { color: { argb: "FFFF0000" } };
    const priceCell = sheet.getCell(r, 8);
    priceCell.value = item.unitPrice;
    priceCell.numFmt = NUM_FORMAT;
    const amountCell = sheet.getCell(r, 9);
    amountCell.value = { formula: `G${r}*H${r}` };
    amountCell.numFmt = NUM_FORMAT;
    const taxCell = sheet.getCell(r, 10);
    taxCell.value = { formula: `I${r}*0.1` };
    taxCell.numFmt = NUM_FORMAT;
    applyRowBorder(sheet, r, 11, [1, 2, 3, 11]);
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
  applyRowBorder(sheet, totalRow, 11, [1, 2, 3, 11]);

  return workbook;
}
