import { describe, expect, it } from "vitest";
import { buildSourceItems, daysBetween, findOverdueCustomers } from "./dashboard-todo";

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

describe("buildSourceItems", () => {
  const input = {
    approvals: [{ id: "d1", title: "지급결의서", createdAt: "2026-11-12T01:00:00Z", authorName: "김부장" }],
    overdue: [{ id: "c1", name: "세진기획", balance: 318000, daysOverdue: 40 }],
    payables: [{ id: "s1", name: "리더스특수지", balance: 6000000, daysOverdue: 35 }],
    todos: [{ id: "t1", title: "납품 확인 전화", due_date: "2026-11-10" }, { id: "t2", title: "견적 정리", due_date: null }],
    carryovers: [{ fromDate: "2026-11-10", itemCount: 2, kind: "sales" as const }],
    lowStock: [{ id: "p1", name: "모조지 70", quantity: 2, reorderPoint: 10 }],
    announcements: [{ id: "a1", title: "11월 휴무 안내", pinned: true }],
    mails: [],
    sentMails: [],
    chats: [],
    boards: [],
    memos: [{ id: "m1", noteDate: "2026-11-12", content: "에이티씨 납품 오후 3시", author: "김과장" }],
    todayStr: "2026-11-12",
    backHref: "%2Fdashboard",
  };

  it("내용(원천)별로 항목을 만들고 문구와 링크를 붙인다", () => {
    const out = buildSourceItems(input);
    expect(out.approval[0]).toMatchObject({ sub: "김부장 기안", href: "/approvals?id=d1" });
    expect(out.overdue[0].title).toContain("318,000원");
    expect(out.payable[0]).toMatchObject({ href: "/payables", due: "35일 지남" });
    expect(out.todo[0]).toMatchObject({ due: "지연", href: "/todos/t1?back=%2Fdashboard" });
    expect(out.todo[1].sub).toBe("마감일 없음");
    expect(out.carryover[0]).toMatchObject({ title: "11/10 작업분 매출 품목 2건", href: "/sales?from=2026-11-10&to=2026-11-10" });
    expect(out.lowStock[0]).toMatchObject({ title: "모조지 70", sub: "현재 2 / 기준 10", href: "/inventory/item/p1" });
    expect(out.announcement[0].title).toBe("📌 11월 휴무 안내");
    expect(out.memo[0]).toMatchObject({ title: "에이티씨 납품 오후 3시", sub: "김과장", due: "11/12", href: "/dashboard?month=2026-11" });
  });

  it("모든 항목의 key가 서로 다르다", () => {
    const all = Object.values(buildSourceItems(input)).flat();
    expect(new Set(all.map((i) => i.key)).size).toBe(all.length);
  });
});
