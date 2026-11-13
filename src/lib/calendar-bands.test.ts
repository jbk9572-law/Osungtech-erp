import { describe, expect, it } from "vitest";
import { MAX_BANDS, buildDayBands, buildDayCounts, bandsTooltip, type BandSource } from "./calendar-bands";

const empty: BandSource = { salesItems: [], purchaseItems: [], calendarItems: [], todoItems: [], notes: [] };
const item = (partnerName: string, productName: string, extra: object = {}) => ({ partnerName, productName, ...extra });

describe("buildDayBands", () => {
  it("거래처별로 묶어 업체명·첫 품목·나머지 종류 수를 보여준다", () => {
    const { all } = buildDayBands(
      { ...empty, salesItems: [item("에이티씨", "크라프트지"), item("에이티씨", "골판지"), item("신광", "필터")] },
      { lowStockCount: 0 },
    );
    expect(all).toEqual([
      { kind: "sales", tag: "매출", text: "에이티씨 · 크라프트지 외1" },
      { kind: "sales", tag: "매출", text: "신광 · 필터" },
    ]);
  });

  it("반품만 있는 거래처는 '반품' 표시를 붙인다", () => {
    const { all } = buildDayBands({ ...empty, purchaseItems: [item("대성", "원지", { isReturn: true })] }, { lowStockCount: 0 });
    expect(all[0]).toMatchObject({ kind: "purchase", tag: "매입반품" });
  });

  it("순서는 매출→매입→할 일→일정→재고→메모→이월, 4줄까지 보이고 나머지는 개수로 센다", () => {
    const { all, shown, more } = buildDayBands(
      {
        salesItems: [item("A", "a")],
        purchaseItems: [item("B", "b", { isCarryover: true })],
        todoItems: [{ title: "전화" }],
        calendarItems: [{ title: "회의", allDay: false, startAt: "2026-11-12T14:00:00" }],
        notes: [{ content: "메모1" }, { content: "메모2" }],
      },
      { lowStockCount: 2 },
    );
    expect(all.map((b) => b.kind)).toEqual(["sales", "purchase", "todo", "event", "stock", "note", "carry"]);
    expect(shown).toHaveLength(MAX_BANDS);
    expect(more).toBe(all.length - MAX_BANDS);
    expect(all.find((b) => b.kind === "event")).toMatchObject({ tag: "14:00", text: "회의" });
    expect(all.find((b) => b.kind === "note")?.text).toBe("메모1 외1");
  });

  it("아무 내용이 없으면 비어 있고 툴팁도 없다", () => {
    const r = buildDayBands(undefined, { lowStockCount: 0 });
    expect(r).toEqual({ all: [], shown: [], more: 0 });
    expect(bandsTooltip(r.all)).toBeUndefined();
  });

  it("툴팁은 모든 띠를 줄바꿈으로 잇는다", () => {
    const { all } = buildDayBands({ ...empty, salesItems: [item("A", "a")], todoItems: [{ title: "전화" }] }, { lowStockCount: 0 });
    expect(bandsTooltip(all)).toBe("매출 A · a\n할일 전화");
  });
});

describe("buildDayCounts", () => {
  it("0건인 종류는 빼고 순서(매출·매입·할 일·일정·재고 부족)대로 건수만 돌려준다", () => {
    const rows = buildDayCounts({ salesCount: 3, purchaseCount: 0, todoItems: [1], calendarItems: [1, 2] }, { lowStockCount: 1 });
    expect(rows).toEqual([
      { kind: "sales", label: "매출", count: 3 },
      { kind: "todo", label: "할 일", count: 1 },
      { kind: "event", label: "일정", count: 2 },
      { kind: "stock", label: "재고 부족", count: 1 },
    ]);
  });
  it("아무것도 없으면 빈 목록", () => {
    expect(buildDayCounts(undefined, { lowStockCount: 0 })).toEqual([]);
  });
});
