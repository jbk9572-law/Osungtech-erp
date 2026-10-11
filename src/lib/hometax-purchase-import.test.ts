import { describe, it, expect } from "vitest";
import { parseHometaxReceivedInvoiceRows } from "./hometax-purchase-import";
import type { ExcelRow } from "./excel-import";

describe("parseHometaxReceivedInvoiceRows", () => {
  it("승인번호 헤더가 없으면 명확한 오류를 돌려준다", () => {
    const rows: ExcelRow[] = [{ 날짜: "2026-10-05", 금액: 1000 }];
    const { parsed, errors } = parseHometaxReceivedInvoiceRows(rows);
    expect(parsed).toHaveLength(0);
    expect(errors[0].reason).toMatch(/승인번호/);
  });

  it("정상 행을 올바르게 파싱한다", () => {
    const rows: ExcelRow[] = [
      {
        승인번호: "20261005-12345678-12345678",
        작성일자: "20261005",
        공급자등록번호: "123-45-67890",
        공급자상호: "신성제지",
        공급가액: 100000,
        세액: 10000,
        합계금액: 110000,
      },
    ];
    const { parsed, errors } = parseHometaxReceivedInvoiceRows(rows);
    expect(errors).toHaveLength(0);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      approvalNumber: "20261005-12345678-12345678",
      issueDate: "2026-10-05",
      supplierBusinessNumber: "1234567890",
      supplierName: "신성제지",
      supplyAmount: 100000,
      taxAmount: 10000,
      totalAmount: 110000,
    });
  });

  it("합계금액 칸이 없으면 공급가액+세액으로 보충한다", () => {
    const rows: ExcelRow[] = [
      {
        승인번호: "a",
        작성일자: "2026-10-05",
        공급자상호: "신성제지",
        공급가액: 50000,
        세액: 5000,
      },
    ];
    const { parsed } = parseHometaxReceivedInvoiceRows(rows);
    expect(parsed[0].totalAmount).toBe(55000);
  });

  it("필수 칸(승인번호/작성일자/공급자상호)이 비어있는 행은 오류로 걸러낸다", () => {
    const rows: ExcelRow[] = [
      { 승인번호: "20261005-12345678-12345678", 작성일자: "20261005", 공급자상호: "신성제지", 공급가액: 1000 },
      { 승인번호: "", 작성일자: "20261005", 공급자상호: "신성제지" },
    ];
    const { parsed, errors } = parseHometaxReceivedInvoiceRows(rows);
    expect(parsed).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(3);
  });
});
