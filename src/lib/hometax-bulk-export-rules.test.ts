import { describe, expect, it } from "vitest";
import { hometaxByteLength, validateHometaxRow, HOMETAX_FIELD_RULES } from "./hometax-bulk-export-rules";
import { HOMETAX_BULK_EXCEL_HEADERS, classifyAndBuildRows, type BulkExportInvoice, type SupplierInfo } from "./hometax-bulk-export";

describe("hometaxByteLength", () => {
  it("영문/숫자는 1바이트", () => {
    expect(hometaxByteLength("abc123")).toBe(6);
  });

  it("한글은 2바이트", () => {
    expect(hometaxByteLength("한글")).toBe(4);
  });

  it("섞여도 정확히 센다", () => {
    expect(hometaxByteLength("엘보닉스ERP")).toBe(4 * 2 + 3); // 엘보닉스(4글자*2) + ERP(3글자*1)
  });
});

describe("HOMETAX_FIELD_RULES", () => {
  it("열 개수가 HOMETAX_BULK_EXCEL_HEADERS와 정확히 59개로 일치한다", () => {
    expect(HOMETAX_FIELD_RULES.length).toBe(HOMETAX_BULK_EXCEL_HEADERS.length);
    expect(HOMETAX_BULK_EXCEL_HEADERS.length).toBe(59);
  });
});

// 국세청 홈택스 공식 양식 파일의 "올바른 예시" 시트에 실제로 들어있던
// 값(필수 기재사항은 그대로, 거래처명 등은 양식 자체가 "샘플공급자"
// 같은 더미 값이었음) — 이 값들로 만든 행은 검증을 통과해야 한다.
const CORRECT_EXAMPLE_ROW: Record<string, unknown> = Object.fromEntries(
  HOMETAX_BULK_EXCEL_HEADERS.map((h, i) => {
    const values = [
      "01", "20220214", "1234567890", "", "샘플공급자", "홍길동", "서울시", "농업", "식품", "sample@sample.com",
      "1234567890", "", "샘플공급받는자", "샘플", "서울시", "광업", "철", "sample1@sample.com", "sample2@sample.com",
      "10000", "1000", "",
      "02", "광물", "", "10", "1000", "10000", "1000", "",
      "", "", "", "", "", "", "", "",
      "", "", "", "", "", "", "", "",
      "", "", "", "", "", "", "", "",
      "", "", "", "", "01",
    ];
    return [h, values[i]];
  }),
);

describe("validateHometaxRow — 올바른 예시", () => {
  it("공식 양식의 올바른 예시 값은 오류 없이 통과한다", () => {
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, CORRECT_EXAMPLE_ROW)).toEqual([]);
  });
});

// "잘못된 예시" 시트에 실제로 있던 흔한 실패 패턴들 — 하나씩 재현해서
// 검증기가 제대로 잡아내는지 확인한다.
describe("validateHometaxRow — 잘못된 예시", () => {
  function withOverride(overrides: Record<string, unknown>) {
    return { ...CORRECT_EXAMPLE_ROW, ...overrides };
  }

  it("종류가 01/02가 아니면 오류", () => {
    const row = withOverride({ [HOMETAX_BULK_EXCEL_HEADERS[0]]: "03" });
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, row).some((e) => e.includes("전자(세금)계산서 종류"))).toBe(true);
  });

  it("작성일자가 YYYYMMDD 8자리가 아니면 오류", () => {
    const row = withOverride({ [HOMETAX_BULK_EXCEL_HEADERS[1]]: "0213" });
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, row).some((e) => e.includes("작성일자"))).toBe(true);
  });

  it("등록번호에 하이픈이 있으면 오류", () => {
    const row = withOverride({ [HOMETAX_BULK_EXCEL_HEADERS[2]]: "XXX-XX-XXXXX" });
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, row).some((e) => e.includes("공급자 등록번호"))).toBe(true);
  });

  it("공급받는자 종사업장번호가 4자리를 넘으면 오류", () => {
    const row = withOverride({ [HOMETAX_BULK_EXCEL_HEADERS[11]]: "99999" });
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, row).some((e) => e.includes("종사업장번호"))).toBe(true);
  });

  it("수량이 정수부 10자리를 넘으면 오류", () => {
    const row = withOverride({ 수량1: "111111111111" });
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, row).some((e) => e.includes("수량1"))).toBe(true);
  });

  it("단가가 정수부 13자리를 넘으면 오류", () => {
    const row = withOverride({ 단가1: "111111111111111" });
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, row).some((e) => e.includes("단가1"))).toBe(true);
  });

  it("영수/청구가 01/02가 아니면 오류", () => {
    const row = withOverride({ [HOMETAX_BULK_EXCEL_HEADERS[58]]: "03" });
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, row).some((e) => e.includes("영수"))).toBe(true);
  });

  it("품목이 하나도 없으면 오류", () => {
    const row = withOverride({ 품목1: "", "일자1\n(2자리, 작성년월 제외)": "" });
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, row).some((e) => e.includes("1건 이상"))).toBe(true);
  });

  it("일자만 있고 품목명이 없으면(또는 반대) 오류", () => {
    const row = withOverride({ 품목1: "" });
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, row).some((e) => e.includes("한쪽만"))).toBe(true);
  });

  it("공급가액 합계가 품목별 합과 다르면 오류", () => {
    const row = withOverride({ [HOMETAX_BULK_EXCEL_HEADERS[19]]: "99999" });
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, row).some((e) => e.includes("공급가액 합계"))).toBe(true);
  });
});

// 실제 우리 ERP 데이터(TaxInvoiceForm에서 발행된 세금계산서)로 만든 행도
// 검증을 통과하는지 — classifyAndBuildRows가 실제로 규칙에 맞는 출력을
// 만드는지 확인하는 통합 테스트.
describe("classifyAndBuildRows로 만든 행 검증", () => {
  const supplier: SupplierInfo = {
    businessNumber: "123-45-67890",
    name: "엘보닉스",
    representativeName: "홍길동",
    address: "경기도 안산시 영통대로 123",
    businessType: "제조업",
    businessItem: "필터/지류",
    email: "info@elvonix.co.kr",
  };

  it("품목 1~4개인 일반적인 세금계산서는 오류 없이 통과한다", () => {
    const invoice: BulkExportInvoice = {
      salesOrderId: "a",
      invoiceType: "general",
      issueDate: "2026-10-08",
      supplyAmount: 500000,
      taxAmount: 50000,
      cashAmount: 0,
      checkAmount: 0,
      noteAmount: 0,
      creditAmount: 550000,
      claimType: "claim",
      remark: null,
      customerName: "다이아몬드산업",
      customerBusinessNumber: "234-56-78901",
      customerRepresentativeName: "김철수",
      customerAddress: "서울특별시",
      customerBusinessType: "도매",
      customerBusinessItem: "필터",
      customerEmail: "buyer@diamond.co.kr",
      items: [
        {
          line_date: "2026-10-08",
          item_name: "에코 멀티 필터",
          spec: "SPEC-1",
          quantity: 100,
          unit_price: 5000,
          supply_amount: 500000,
          tax_amount: 50000,
          remark: null,
          sort_order: 0,
        },
      ],
    };

    const { rows } = classifyAndBuildRows([invoice], supplier, true);
    expect(rows).toHaveLength(1);
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, rows[0])).toEqual([]);
  });

  it("품목 6개(자동 요약 적용)도 합계가 맞아떨어져 오류 없이 통과한다", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      line_date: "2026-10-05",
      item_name: `품목${i + 1}`,
      spec: "",
      quantity: 1,
      unit_price: 10000,
      supply_amount: 10000,
      tax_amount: 1000,
      remark: null,
      sort_order: i,
    }));
    const invoice: BulkExportInvoice = {
      salesOrderId: "b",
      invoiceType: "zero_rate",
      issueDate: "2026-10-05",
      supplyAmount: 60000,
      taxAmount: 6000,
      cashAmount: 66000,
      checkAmount: 0,
      noteAmount: 0,
      creditAmount: 0,
      claimType: "receipt",
      remark: null,
      customerName: "다량거래업체",
      customerBusinessNumber: "345-67-89012",
      customerRepresentativeName: "이영희",
      customerAddress: "부산",
      customerBusinessType: "도매",
      customerBusinessItem: "지류",
      customerEmail: "a@b.com",
      items,
    };

    const { rows, excluded } = classifyAndBuildRows([invoice], supplier, true);
    expect(excluded).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, rows[0])).toEqual([]);
  });
});
