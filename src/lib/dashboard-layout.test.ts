import { describe, expect, it } from "vitest";
import {
  DASHBOARD_COLS,
  DASHBOARD_WIDGETS,
  defaultDashboardLayout,
  normalizeDashboardLayout,
  stackOrder,
} from "./dashboard-layout";

describe("normalizeDashboardLayout", () => {
  it("저장값이 없거나 이상한 모양이면 기본 배치를 준다", () => {
    for (const raw of [null, undefined, 5, "x", [], {}]) {
      expect(normalizeDashboardLayout(raw)).toEqual(defaultDashboardLayout());
    }
  });

  it("모르는 위젯 id·중복·숫자 아닌 값은 버리고 빠진 위젯은 기본 위치로 채운다", () => {
    const out = normalizeDashboardLayout({
      items: [
        { id: "calendar", x: 0, y: 0, w: 6, h: 12 },
        { id: "calendar", x: 9, y: 9, w: 1, h: 1 },
        { id: "evil", x: 0, y: 0, w: 1, h: 1 },
        { id: "report", x: "a", y: 0, w: 4, h: 10 },
      ],
    });
    const ids = out.items.map((i) => i.id).sort();
    expect(ids).toEqual(DASHBOARD_WIDGETS.map((w) => w.id).sort());
    expect(out.items.find((i) => i.id === "calendar")).toMatchObject({ x: 0, y: 0, w: 6, h: 12 });
    const def = DASHBOARD_WIDGETS.find((w) => w.id === "report")!.def;
    // 값이 깨진 위젯은 기본 크기로 되돌아온다(자리는 겹침 정리로 밀릴 수 있다).
    expect(out.items.find((i) => i.id === "report")).toMatchObject({ w: def.w, h: def.h });
  });

  it("범위를 벗어난 크기·위치는 최소/최대로 맞춘다", () => {
    const out = normalizeDashboardLayout({
      items: [{ id: "calendar", x: 99, y: -5, w: 99, h: 0 }],
    });
    const c = out.items.find((i) => i.id === "calendar")!;
    expect(c.w).toBe(DASHBOARD_COLS);
    expect(c.x + c.w).toBeLessThanOrEqual(DASHBOARD_COLS);
    expect(c.y).toBe(0);
    expect(c.h).toBe(10); // 달력 최소 높이
  });

  it("숨긴 위젯은 배치에서 빠지고 hidden에 남는다(기본 위치로 되살아나지 않는다)", () => {
    const out = normalizeDashboardLayout({ items: [], hidden: ["report", "report", "nope"] });
    expect(out.hidden).toEqual(["report"]);
    expect(out.items.some((i) => i.id === "report")).toBe(false);
  });
});

describe("resolveOverlaps", () => {
  it("겹친 위젯은 아래로 밀고, 겹치지 않는 배치는 그대로 둔다", () => {
    const out = normalizeDashboardLayout({
      items: [
        { id: "calendar", x: 0, y: 0, w: 6, h: 12 },
        { id: "report", x: 3, y: 4, w: 4, h: 10 },
      ],
    });
    const c = out.items.find((i) => i.id === "calendar")!;
    const r = out.items.find((i) => i.id === "report")!;
    expect(c.y).toBe(0);
    expect(r.y).toBeGreaterThanOrEqual(12);
    for (const a of out.items) for (const b of out.items) {
      if (a === b) continue;
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap, `${a.id}/${b.id}`).toBe(false);
    }
  });
});

describe("stackOrder", () => {
  it("위→아래, 같은 줄이면 왼쪽→오른쪽 순서", () => {
    const order = stackOrder(defaultDashboardLayout());
    expect(order.indexOf("todo")).toBeLessThan(order.indexOf("calendar"));
    expect(order[0]).toBe("kpi");
  });
});

describe("기본 배치", () => {
  it("모든 위젯이 겹치지 않고 12칸 안에 들어간다", () => {
    const items = defaultDashboardLayout().items;
    for (const a of items) {
      expect(a.x + a.w, a.id).toBeLessThanOrEqual(DASHBOARD_COLS);
      for (const b of items) {
        if (a === b) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.id}/${b.id}`).toBe(false);
      }
    }
  });
});
