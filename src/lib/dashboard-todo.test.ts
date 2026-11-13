import { describe, expect, it } from "vitest";
import { buildTodoItems, daysBetween, findOverdueCustomers } from "./dashboard-todo";

describe("daysBetween", () => {
  it("날짜 문자열끼리 일수를 센다", () => {
    expect(daysBetween("2026-11-05", "2026-11-12")).toBe(7);
    expect(daysBetween("2026-10-31", "2026-11-01")).toBe(1);
    expect(daysBetween("x", "2026-11-01")).toBe(0);
  });
});

describe("findOverdueCustomers", () => {
  const today = "2026-11-12";
  const bal = (id: string, balance: number, oldest: string | null) => ({ id, name: id, total: balance, paid: 0, balance, oldestUnpaidDate: oldest });
  it("30일 이상 밀린 잔액만, 오래된 순·금액 큰 순으로", () => {
    const out = findOverdueCustomers(
      [bal("a", 100, "2026-10-01"), bal("b", 500, "2026-10-01"), bal("c", 900, "2026-11-10"), bal("d", 0, "2026-09-01"), bal("e", 50, null), bal("f", 10, "2026-09-01")],
      today,
    );
    expect(out.map((o) => o.id)).toEqual(["f", "b", "a"]);
    expect(out[0].daysOverdue).toBe(72);
  });
});

describe("buildTodoItems", () => {
  it("결재 → 연체 → 내 할 일 → 이월 순서로 한 목록에 담고, 문구와 링크를 만든다", () => {
    const items = buildTodoItems({
      approvals: [{ id: "d1", title: "지급결의서", createdAt: "2026-11-12T01:00:00Z", authorName: "김부장" }],
      overdue: [{ id: "c1", name: "세진기획", balance: 318000, daysOverdue: 40 }],
      todos: [{ id: "t1", title: "납품 확인 전화", due_date: "2026-11-10" }, { id: "t2", title: "견적 정리", due_date: null }],
      carryovers: [{ fromDate: "2026-11-10", itemCount: 2, kind: "sales" }],
      todayStr: "2026-11-12",
      backHref: "%2Fdashboard",
    });
    expect(items.map((i) => i.kind)).toEqual(["approval", "overdue", "todo", "todo", "carryover"]);
    expect(items[0]).toMatchObject({ sub: "김부장 기안", href: "/approvals?id=d1" });
    expect(items[1].title).toContain("318,000원");
    expect(items[2]).toMatchObject({ due: "지연", href: "/todos/t1?back=%2Fdashboard" });
    expect(items[3].sub).toBe("마감일 없음");
    expect(items[4]).toMatchObject({ title: "11/10 작업분 매출 품목 2건", href: "/sales?from=2026-11-10&to=2026-11-10" });
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });
});
