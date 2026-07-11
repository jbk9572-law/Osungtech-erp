import ExcelJS from "exceljs";

// WOTE(매입처)에서 원자재(KD238VA/KD240BI/KINGFA 등)를 받아 신일베스텍(매출처)에게
// 내보내는 흐름을 추적하는 전용 관리대장. 일반 명세표와 달리 매입/매출 양쪽
// 데이터를 한 표에 합쳐서 보여준다. 사용자가 "규격" 칸에 LOT번호를 직접
// 입력하는 걸 그대로 LOT.NO로 옮겨쓴다.
//
// 원본 참고 파일은 날짜별 컬럼 피벗 + SUMIFS로 만들어져 있었지만, 매달 자동
// 생성하는 용도로는 거래 목록 + 품목별 누적 재고 형태가 더 간단하고 정확하다.
// entries에는 이번 달 이전 전체 내역도 같이 넘어오는데, from 이전 것들은
// 화면에 줄로 안 뿌리고 합산해서 "이월" 한 줄로만 보여준다(매달 0에서
// 다시 시작하지 않도록).

export type LedgerEntry = {
  date: string; // YYYY-MM-DD
  productName: string;
  lotNo: string; // spec 필드에 사용자가 직접 입력한 LOT번호
  direction: "in" | "out"; // in = WOTE에서 입고, out = 신일베스텍으로 출고
  partnerName: string;
  quantity: number;
};

const NUM_FORMAT = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-';

export async function buildWoteLedgerWorkbook(
  year: number,
  month: number,
  from: string,
  entries: LedgerEntry[]
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${year}-${month}`);

  sheet.columns = [
    { width: 12 }, // 날짜
    { width: 16 }, // 품명
    { width: 14 }, // LOT.NO
    { width: 10 }, // 입고
    { width: 10 }, // 출고
    { width: 10 }, // 재고
    { width: 16 }, // 거래처명
    { width: 16 }, // 비고
  ];

  sheet.mergeCells("A1:H1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `WOTE 관리대장 ${month}月`;
  titleCell.font = { bold: true, size: 18 };
  titleCell.alignment = { horizontal: "center" };

  const headers = ["날짜", "품명", "LOT.NO", "입고", "출고", "재고", "거래처명", "비고"];
  headers.forEach((label, i) => {
    const cell = sheet.getCell(3, i + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    cell.border = { top: { style: "thin" }, bottom: { style: "double" } };
  });

  // 품목별로 묶어서 날짜순으로 나열한다. from 이전 내역은 화면에 줄로 안
  // 뿌리고 합산해서 이월재고로만 반영한다.
  const byProduct = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const list = byProduct.get(entry.productName) ?? [];
    list.push(entry);
    byProduct.set(entry.productName, list);
  }

  let row = 4;
  for (const [productName, list] of byProduct) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const before = sorted.filter((e) => e.date < from);
    const thisMonth = sorted.filter((e) => e.date >= from);

    let stock = before.reduce((sum, e) => sum + (e.direction === "in" ? e.quantity : -e.quantity), 0);

    if (before.length > 0) {
      sheet.getCell(row, 2).value = productName;
      sheet.getCell(row, 3).value = "이월";
      const stockCell = sheet.getCell(row, 6);
      stockCell.value = stock;
      stockCell.numFmt = NUM_FORMAT;
      row += 1;
    }

    for (const entry of thisMonth) {
      const inQty = entry.direction === "in" ? entry.quantity : 0;
      const outQty = entry.direction === "out" ? entry.quantity : 0;
      stock += inQty - outQty;

      sheet.getCell(row, 1).value = new Date(`${entry.date}T00:00:00`);
      sheet.getCell(row, 1).numFmt = 'mm"월" dd"일"';
      sheet.getCell(row, 2).value = productName;
      sheet.getCell(row, 3).value = entry.lotNo || null;
      if (inQty) {
        const c = sheet.getCell(row, 4);
        c.value = inQty;
        c.numFmt = NUM_FORMAT;
      }
      if (outQty) {
        const c = sheet.getCell(row, 5);
        c.value = outQty;
        c.numFmt = NUM_FORMAT;
      }
      const stockCell = sheet.getCell(row, 6);
      stockCell.value = stock;
      stockCell.numFmt = NUM_FORMAT;
      sheet.getCell(row, 7).value = entry.partnerName;
      row += 1;
    }
  }

  return workbook;
}
