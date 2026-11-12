import { describe, expect, it } from "vitest";
import { buildDailyReportText, formatReportDateLabel } from "./daily-report-text";

const base = {
  dateStr: "2026-11-12",
  salesCount: 2,
  salesTotal: 12480000,
  purchaseCount: 1,
  purchaseTotal: 9860000,
  salesLines: ["- (주)에이티씨", "  · 크라프트지 98", "    605*685 : 20,000 EA"],
  purchaseLines: ["- 피엠씨테크놀로지", "  · Cover tape", "    37.5mm x 480m : 240 ROLL (20박스)"],
  collected: 3200000,
  paid: 1500000,
  lowStock: [{ name: "모조지 70", quantity: 2, reorderPoint: 10 }],
  options: { includeAmounts: false, includePayments: false, includeStock: true },
};

describe("formatReportDateLabel", () => {
  it("날짜에 요일을 붙인다(타임존과 무관)", () => {
    expect(formatReportDateLabel("2026-11-12")).toBe("2026-11-12 (목)");
    expect(formatReportDateLabel("2026-01-01")).toBe("2026-01-01 (목)");
  });
  it("잘못된 날짜는 그대로 돌려준다", () => {
    expect(formatReportDateLabel("abc")).toBe("abc");
  });
});

describe("buildDailyReportText", () => {
  it("기본: 매출·매입 품목과 재고 부족만 담고 금액/수금은 넣지 않는다", () => {
    const text = buildDailyReportText(base);
    expect(text).toContain("2026-11-12 (목) 오늘 리포트");
    expect(text).toContain("[매출] 2건");
    expect(text).toContain("    605*685 : 20,000 EA");
    expect(text).toContain("[매입] 1건");
    expect(text).toContain("(20박스)");
    expect(text).toContain("[재고 부족] 1건");
    expect(text).toContain("- 모조지 70 : 현재 2 / 기준 10");
    expect(text).not.toContain("원");
    expect(text).not.toContain("[금액 합계]");
    expect(text).not.toContain("[수금·지급]");
  });

  it("금액·수금지급을 켜면 해당 줄이 추가된다", () => {
    const text = buildDailyReportText({
      ...base,
      options: { includeAmounts: true, includePayments: true, includeStock: false },
    });
    expect(text).toContain("[금액 합계]\n매출 12,480,000원 · 매입 9,860,000원");
    expect(text).toContain("[수금·지급]\n수금 3,200,000원 · 지급 1,500,000원");
    expect(text).not.toContain("[재고 부족]");
  });

  it("권한이 없어 null인 수금/지급은 켜도 글에 넣지 않는다", () => {
    const text = buildDailyReportText({
      ...base,
      collected: null,
      paid: null,
      options: { includeAmounts: false, includePayments: true, includeStock: false },
    });
    expect(text).not.toContain("[수금·지급]");
  });

  it("한쪽만 있으면 그쪽만 쓴다", () => {
    const text = buildDailyReportText({
      ...base,
      paid: null,
      options: { includeAmounts: false, includePayments: true, includeStock: false },
    });
    expect(text).toContain("수금 3,200,000원");
    expect(text).not.toContain("지급 1,500,000원");
  });

  it("거래가 하나도 없는 날은 '없음'으로 쓴다", () => {
    const text = buildDailyReportText({
      ...base,
      salesCount: 0,
      purchaseCount: 0,
      salesLines: [],
      purchaseLines: [],
      lowStock: [],
    });
    expect(text).toContain("[매출] 없음");
    expect(text).toContain("[매입] 없음");
    expect(text).not.toContain("[재고 부족]");
  });
});
