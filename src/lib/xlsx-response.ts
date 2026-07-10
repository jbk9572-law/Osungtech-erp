import * as XLSX from "xlsx";
import type { Workbook } from "exceljs";

export function buildXlsxResponse(rows: Record<string, unknown>[], filename: string): Response {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return respondWithBuffer(buffer, filename);
}

// 거래처마다 정해진 고정 서식(글꼴 굵기·테두리·채우기색·실제 수식까지 있는
// 장부 양식)은 표 헤더 하나로 표현할 수 없어 exceljs로 셀 단위로 그린다.
export async function buildXlsxResponseFromWorkbook(workbook: Workbook, filename: string): Promise<Response> {
  const buffer = await workbook.xlsx.writeBuffer();
  return respondWithBuffer(Buffer.from(buffer), filename);
}

function respondWithBuffer(buffer: Buffer, filename: string): Response {
  return new Response(new Blob([new Uint8Array(buffer)]), {
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
