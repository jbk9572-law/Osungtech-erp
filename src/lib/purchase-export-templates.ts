import ExcelJS from "exceljs";

// 매입처마다 실제로 쓰는 엑셀 장부 양식이 있어서, 그 업체로 다운로드할 때는
// 우리 시스템의 일반 컬럼 나열 대신 이 양식대로(글꼴 굵기·테두리·채우기색·
// 실제 수식까지) 셀을 그려서 내려준다. 업로드받은 실제 파일을 열어 셀 단위로
// 확인한 구조를 그대로 재현했다: A1 업체명(굵게, 20pt) + I1 월, 5~6행 총액/VAT
// 합계(굵게, 원화 서식, VAT 행은 노란색 채우기), 8행 매입내역(진한 채우기,
// 두꺼운 테두리) + 박스·수량 합계, 9행 헤더(회색 채우기, 아래쪽 이중선),
// 10행부터 데이터(가는 테두리, 날짜는 같은 날짜면 첫 줄에만 표시).

export type LedgerItem = {
  date: string; // YYYY-MM-DD
  productName: string;
  spec: string;
  unit: string;
  quantity: number;
  unitCost: number;
  basePackageQty: number | null;
};

const WON_FORMAT = '_-"₩"* #,##0_-;-"₩"* #,##0_-;_-"₩"* "-"_-;_-@_-';
const NUM_FORMAT = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-';

function boxBorder(style: "thin" | "medium" = "thin"): Partial<ExcelJS.Borders> {
  return { top: { style }, bottom: { style }, left: { style }, right: { style } };
}

export async function buildStandardLedgerWorkbook(
  vendorName: string,
  year: number,
  month: number,
  items: LedgerItem[],
  priceBasis: "box" | "quantity"
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${String(year).slice(2)}-${month}`);

  sheet.columns = [
    { width: 10 }, // A 날짜
    { width: 16 }, // B 품명
    { width: 14 }, // C 규격
    { width: 11 }, // D 단위
    { width: 9 }, // E 박스
    { width: 10 }, // F 수량
    { width: 11 }, // G 단가
    { width: 12 }, // H 금액
    { width: 18 }, // I 비고
  ];

  sheet.mergeCells("A1:G1");
  sheet.mergeCells("A2:G2");
  sheet.mergeCells("I1:I2");

  const nameCell = sheet.getCell("A1");
  nameCell.value = vendorName;
  nameCell.font = { bold: true, size: 20 };
  nameCell.alignment = { horizontal: "center", vertical: "middle" };
  nameCell.border = { top: { style: "thin" }, left: { style: "thin" } };
  sheet.getCell("G1").border = { top: { style: "thin" }, right: { style: "thin" } };
  sheet.getCell("A2").border = { bottom: { style: "thin" }, left: { style: "thin" } };
  sheet.getCell("G2").border = { bottom: { style: "thin" }, right: { style: "thin" } };

  const monthCell = sheet.getCell("I1");
  monthCell.value = `${month}월`;
  monthCell.font = { size: 14 };
  monthCell.alignment = { horizontal: "center", vertical: "middle" };
  monthCell.border = boxBorder();

  const yearCell = sheet.getCell("I3");
  yearCell.value = year;
  yearCell.font = { size: 14 };
  yearCell.alignment = { horizontal: "center" };

  const lastDataRow = 9 + items.length;

  const totalLabelCell = sheet.getCell("A5");
  totalLabelCell.value = "총액";
  const vatLabelCell = sheet.getCell("A6");
  vatLabelCell.value = "VAT 합계";
  [totalLabelCell, vatLabelCell].forEach((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center" };
    cell.border = boxBorder();
  });

  const totalCell = sheet.getCell("B5");
  totalCell.value = { formula: `SUM(H10:H${lastDataRow})` };
  totalCell.numFmt = WON_FORMAT;
  totalCell.font = { bold: true };
  totalCell.alignment = { horizontal: "center" };
  totalCell.border = boxBorder();

  const vatCell = sheet.getCell("B6");
  vatCell.value = { formula: "B5*1.1" };
  vatCell.numFmt = WON_FORMAT;
  vatCell.font = { bold: true };
  vatCell.alignment = { horizontal: "center" };
  vatCell.border = boxBorder();
  vatCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };

  const summaryLabelCell = sheet.getCell("A8");
  summaryLabelCell.value = "매입내역";
  summaryLabelCell.font = { bold: true };
  summaryLabelCell.alignment = { horizontal: "center" };
  summaryLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
  summaryLabelCell.border = boxBorder("medium");

  const boxTotalCell = sheet.getCell("E8");
  boxTotalCell.value = { formula: `SUM(E10:E${lastDataRow})` };
  boxTotalCell.numFmt = NUM_FORMAT;
  boxTotalCell.alignment = { horizontal: "center" };

  const qtyTotalCell = sheet.getCell("F8");
  qtyTotalCell.value = { formula: `SUM(F10:F${lastDataRow})` };
  qtyTotalCell.numFmt = NUM_FORMAT;
  qtyTotalCell.alignment = { horizontal: "center" };

  const headers = ["", "품명", "규격", "단위", "박스", "수량", "단가", "금액", "비고"];
  headers.forEach((label, i) => {
    const cell = sheet.getCell(9, i + 1);
    if (label) cell.value = label;
    cell.alignment = { horizontal: "center" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "double" },
      left: { style: i === 0 ? "thin" : "hair" },
      right: { style: i === headers.length - 1 ? "thin" : "hair" },
    };
  });

  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  let lastDate = "";
  sorted.forEach((item, idx) => {
    const r = 10 + idx;
    // 포장수량이 없는 품목은 "1개=1박스"로 취급해 최소한 금액 수식(단가×박스)이
    // 0이 되지 않게 한다.
    const box = item.basePackageQty ? item.quantity / item.basePackageQty : item.quantity;

    const dateCell = sheet.getCell(r, 1);
    if (item.date !== lastDate) {
      dateCell.value = new Date(`${item.date}T00:00:00`);
      dateCell.numFmt = 'mm"월" dd"일"';
    }
    lastDate = item.date;

    sheet.getCell(r, 2).value = item.productName;
    sheet.getCell(r, 3).value = item.spec || null;
    sheet.getCell(r, 4).value = item.unit || null;
    const boxCell = sheet.getCell(r, 5);
    boxCell.value = Number(box.toFixed(2));
    boxCell.numFmt = NUM_FORMAT;
    const qtyCell = sheet.getCell(r, 6);
    qtyCell.value = item.quantity;
    qtyCell.numFmt = NUM_FORMAT;
    const costCell = sheet.getCell(r, 7);
    costCell.value = item.unitCost;
    costCell.numFmt = NUM_FORMAT;

    const amountCell = sheet.getCell(r, 8);
    amountCell.value = priceBasis === "box" ? { formula: `G${r}*E${r}` } : { formula: `F${r}*G${r}` };
    amountCell.numFmt = NUM_FORMAT;

    for (let c = 1; c <= 9; c++) {
      const cell = sheet.getCell(r, c);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "hair" },
        bottom: { style: "hair" },
        left: { style: c === 1 ? "thin" : "hair" },
        right: { style: c === 9 ? "thin" : "hair" },
      };
    }
  });

  for (let r = 1; r <= lastDataRow; r++) {
    sheet.getRow(r).height = 22.5;
  }

  return workbook;
}

// 리더스특수지: 원본은 품목군 2개를 나란히 두고 무게까지 추적하는 훨씬
// 복잡한 자체 양식이지만, 우리 시스템엔 무게·품목군 구분 데이터가 없어
// 그대로 재현할 수 없다. 일자/품명/규격/수량/단가/금액/비고로 단순화한
// 표로 대신하되, 표준 양식과 같은 스타일(굵은 제목·테두리·원화 서식)은
// 유지한다.
export async function buildLeadersSpecialWorkbook(
  vendorName: string,
  year: number,
  month: number,
  items: LedgerItem[]
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${String(year).slice(2)}-${month}`);

  sheet.columns = [
    { width: 12 }, // A 일자
    { width: 18 }, // B 품명
    { width: 14 }, // C 규격
    { width: 10 }, // D 수량
    { width: 11 }, // E 단가
    { width: 12 }, // F 금액
    { width: 18 }, // G 비고
  ];

  sheet.mergeCells("A1:E1");
  const nameCell = sheet.getCell("A1");
  nameCell.value = vendorName;
  nameCell.font = { bold: true, size: 20 };
  nameCell.alignment = { horizontal: "center", vertical: "middle" };
  nameCell.border = boxBorder();

  const monthCell = sheet.getCell("F1");
  monthCell.value = `${month}월`;
  monthCell.font = { size: 14 };
  monthCell.alignment = { horizontal: "center" };

  const lastDataRow = 8 + items.length;

  const totalLabelCell = sheet.getCell("A3");
  totalLabelCell.value = "총액";
  const vatLabelCell = sheet.getCell("A4");
  vatLabelCell.value = "VAT 합계";
  [totalLabelCell, vatLabelCell].forEach((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center" };
    cell.border = boxBorder();
  });

  const totalCell = sheet.getCell("B3");
  totalCell.value = { formula: `SUM(F8:F${lastDataRow})` };
  totalCell.numFmt = WON_FORMAT;
  totalCell.font = { bold: true };
  totalCell.alignment = { horizontal: "center" };
  totalCell.border = boxBorder();

  const vatCell = sheet.getCell("B4");
  vatCell.value = { formula: "B3*1.1" };
  vatCell.numFmt = WON_FORMAT;
  vatCell.font = { bold: true };
  vatCell.alignment = { horizontal: "center" };
  vatCell.border = boxBorder();
  vatCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };

  const headers = ["일자", "품명", "규격", "수량", "단가", "금액", "비고"];
  headers.forEach((label, i) => {
    const cell = sheet.getCell(7, i + 1);
    cell.value = label;
    cell.alignment = { horizontal: "center" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "double" },
      left: { style: i === 0 ? "thin" : "hair" },
      right: { style: i === headers.length - 1 ? "thin" : "hair" },
    };
  });

  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  let lastDate = "";
  sorted.forEach((item, idx) => {
    const r = 8 + idx;

    const dateCell = sheet.getCell(r, 1);
    if (item.date !== lastDate) {
      dateCell.value = new Date(`${item.date}T00:00:00`);
      dateCell.numFmt = 'mm"월" dd"일"';
    }
    lastDate = item.date;

    sheet.getCell(r, 2).value = item.productName;
    sheet.getCell(r, 3).value = item.spec || null;
    const qtyCell = sheet.getCell(r, 4);
    qtyCell.value = item.quantity;
    qtyCell.numFmt = NUM_FORMAT;
    const costCell = sheet.getCell(r, 5);
    costCell.value = item.unitCost;
    costCell.numFmt = NUM_FORMAT;

    const amountCell = sheet.getCell(r, 6);
    amountCell.value = { formula: `D${r}*E${r}` };
    amountCell.numFmt = NUM_FORMAT;

    for (let c = 1; c <= 7; c++) {
      const cell = sheet.getCell(r, c);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "hair" },
        bottom: { style: "hair" },
        left: { style: c === 1 ? "thin" : "hair" },
        right: { style: c === 7 ? "thin" : "hair" },
      };
    }
  });

  for (let r = 1; r <= lastDataRow; r++) {
    sheet.getRow(r).height = 22.5;
  }

  return workbook;
}
