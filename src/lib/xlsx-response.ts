import * as XLSX from "xlsx";

export function buildXlsxResponse(rows: Record<string, unknown>[], filename: string): Response {
  const sheet = XLSX.utils.json_to_sheet(rows);
  return respondWithSheet(sheet, filename);
}

// 거래처마다 정해진 고정 서식(셀 위치가 중요한 장부 양식)처럼 표 헤더 하나로
// 표현할 수 없는 레이아웃은 행 배열(aoa)을 직접 그려서 만든다.
export function buildXlsxResponseFromRows(
  rows: (string | number | null)[][],
  filename: string
): Response {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  return respondWithSheet(sheet, filename);
}

function respondWithSheet(sheet: XLSX.WorkSheet, filename: string): Response {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const bytes = new Uint8Array(buffer);

  return new Response(new Blob([bytes]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// "해당달" 엑셀 다운로드는 항상 오늘 기준 이번달 1일~말일 범위를 사용한다.
export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const from = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${pad(month)}-${pad(lastDay)}`;
  return { from, to };
}
