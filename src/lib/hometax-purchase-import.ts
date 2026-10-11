import { cell, cellNumber, type ExcelRow } from "@/lib/excel-import";

// 홈택스 [조회/발급 > 매입매출내역 조회] 화면에서 다운로드한 엑셀을 읽는다.
// 발급용 일괄발급 양식(hometax-bulk-export.ts)과 달리 이건 국세청이 열
// "위치"로 읽는 업로드용 양식이 아니라 우리가 "읽기만" 하는 조회
// 다운로드본이라, 열 순서가 고정이라는 보장이 없다 — 그래서 위치가 아니라
// 헤더 텍스트로 찾는다(excel-import.ts의 cell() 방식 그대로). 다만 실제
// 다운로드 파일을 아직 못 받아봐서 아래 후보 헤더 이름은 국세청이 보통
// 쓰는 용어를 기준으로 한 추정이다 — 실제 파일을 받으면 HEADER_CANDIDATES만
// 맞춰 고치면 되고, 그 아래 매칭/저장 로직은 안 바뀐다.
const HEADER_CANDIDATES = {
  approvalNumber: ["승인번호"],
  issueDate: ["작성일자", "발급일자", "작성·발급일자"],
  supplierBusinessNumber: ["공급자등록번호", "공급자사업자등록번호", "사업자등록번호"],
  supplierName: ["공급자상호", "상호", "공급자명"],
  supplyAmount: ["공급가액"],
  taxAmount: ["세액"],
  totalAmount: ["합계금액", "금액합계", "총금액"],
  itemSummary: ["품목", "품목명"],
} as const;

function cellAny(row: ExcelRow, candidates: readonly string[]): string {
  for (const header of candidates) {
    const value = cell(row, header);
    if (value) return value;
  }
  return "";
}

function cellNumberAny(row: ExcelRow, candidates: readonly string[]): number | null {
  for (const header of candidates) {
    const value = cellNumber(row, header);
    if (value !== null) return value;
  }
  return null;
}

// yyyy-mm-dd / yyyy.mm.dd / yyyymmdd 등 홈택스 다운로드에서 흔한 날짜
// 표기를 전부 yyyy-mm-dd로 정규화한다.
function normalizeDate(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export type ParsedReceivedInvoiceRow = {
  rowNum: number;
  approvalNumber: string;
  issueDate: string;
  supplierBusinessNumber: string | null;
  supplierName: string;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  itemSummary: string | null;
};

export type ParseError = { row: number; reason: string };

// 필수 헤더(승인번호/작성일자/상호)를 못 찾으면 바로 명확한 오류로
// 알려준다 — 잘못된 파일을 조용히 빈 결과로 넘기지 않기 위함.
export function parseHometaxReceivedInvoiceRows(
  rows: ExcelRow[],
): { parsed: ParsedReceivedInvoiceRow[]; errors: ParseError[] } {
  const parsed: ParsedReceivedInvoiceRow[] = [];
  const errors: ParseError[] = [];

  if (rows.length > 0) {
    const first = rows[0];
    const hasApproval = HEADER_CANDIDATES.approvalNumber.some((h) => cell(first, h));
    if (!hasApproval) {
      errors.push({
        row: 1,
        reason:
          "승인번호 칸을 찾을 수 없습니다 — 홈택스 매입내역 조회 다운로드 파일이 맞는지, 헤더가 1행에 있는지 확인해주세요.",
      });
      return { parsed, errors };
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    const approvalNumber = cellAny(row, HEADER_CANDIDATES.approvalNumber);
    const issueDateRaw = cellAny(row, HEADER_CANDIDATES.issueDate);
    const supplierName = cellAny(row, HEADER_CANDIDATES.supplierName);
    if (!approvalNumber || !issueDateRaw || !supplierName) {
      errors.push({ row: rowNum, reason: "승인번호/작성일자/공급자상호는 필수입니다." });
      continue;
    }
    const issueDate = normalizeDate(issueDateRaw);
    if (!issueDate) {
      errors.push({ row: rowNum, reason: `작성일자 형식을 읽을 수 없습니다: "${issueDateRaw}"` });
      continue;
    }

    const supplyAmount = cellNumberAny(row, HEADER_CANDIDATES.supplyAmount) ?? 0;
    const taxAmount = cellNumberAny(row, HEADER_CANDIDATES.taxAmount) ?? 0;
    const totalAmount = cellNumberAny(row, HEADER_CANDIDATES.totalAmount) ?? supplyAmount + taxAmount;

    parsed.push({
      rowNum,
      approvalNumber,
      issueDate,
      supplierBusinessNumber: cellAny(row, HEADER_CANDIDATES.supplierBusinessNumber).replace(/[^0-9]/g, "") || null,
      supplierName,
      supplyAmount,
      taxAmount,
      totalAmount,
      itemSummary: cellAny(row, HEADER_CANDIDATES.itemSummary) || null,
    });
  }

  return { parsed, errors };
}
