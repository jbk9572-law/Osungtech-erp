import * as XLSX from "xlsx";

export type ExcelRow = Record<string, unknown>;

export async function readExcelRows(file: File): Promise<ExcelRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: "" });
}

// 엑셀 헤더 표기가 셀 공백/줄바꿈 등으로 살짝 달라도 매칭되도록 정규화해서 조회한다.
function normalizeHeader(key: string) {
  return key.replace(/\s+/g, "").trim();
}

export function cell(row: ExcelRow, header: string): string {
  const target = normalizeHeader(header);
  for (const key of Object.keys(row)) {
    if (normalizeHeader(key) === target) {
      return String(row[key] ?? "").trim();
    }
  }
  return "";
}

export function cellNumber(row: ExcelRow, header: string): number | null {
  const raw = cell(row, header).replace(/,/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// 엑셀 일괄 가져오기에서 기존 행을 갱신할 때, 이번 파일에서 비워둔 칸까지
// 그대로 반영하면 기존 값이 지워진다 — "일부 칸만 채운 축소된 시트"를
// 올리는 경우가 실제로 있어서, 비어있는(null) 칸은 기존 값을 그대로
// 유지해야 한다. customers/suppliers 가져오기가 각자 담당자/연락처 등
// 텍스트 필드마다 똑같은 코드를 중복해서 갖고 있던 것을 하나로 뺐다.
export function fillBlankFieldsFromExisting<T extends Record<string, string | null>>(
  payload: T,
  existing: Partial<Record<keyof T, string | null>> | undefined,
  keys: (keyof T)[]
): T {
  const merged = { ...payload };
  for (const key of keys) {
    if (merged[key] == null) {
      merged[key] = (existing?.[key] ?? null) as T[typeof key];
    }
  }
  return merged;
}

export type ImportRowError = { row: number; reason: string };

export function summarize(total: number, okCount: number, errors: ImportRowError[]) {
  if (errors.length === 0) {
    return { success: `총 ${total}건 중 ${okCount}건 등록/수정 완료.` };
  }
  const detail = errors
    .slice(0, 10)
    .map((e) => `${e.row}행: ${e.reason}`)
    .join(" / ");
  const more = errors.length > 10 ? ` 외 ${errors.length - 10}건` : "";
  return {
    error: `총 ${total}건 중 ${okCount}건 성공, ${errors.length}건 실패 — ${detail}${more}`,
  };
}
