import { describe, expect, it } from "vitest";
import { NestEngine, computeEffectiveReams, type NestLayout } from "./paper-nest-engine";

describe("NestEngine.calculate", () => {
  it("빈 품목 목록이면 빈 결과를 반환한다", () => {
    const engine = new NestEngine();
    const result = engine.calculate([]);
    expect(result.layouts).toEqual([]);
    expect(result.fulfilled).toBe(false);
    expect(result.totalPaper).toBe(0);
  });

  it("원지 안에 전혀 들어가지 않는 규격(가로/세로 모두 원지보다 큼)은 미충족으로 남는다", () => {
    const engine = new NestEngine();
    engine.sheetWidth = 788;
    engine.sheetHeight = 1091;
    const result = engine.calculate([{ name: "너무큼", width: 2000, height: 2000, orderQty: 10 }]);
    expect(result.fulfilled).toBe(false);
    expect(result.layouts).toEqual([]);
    expect(result.remaining["너무큼"]).toBe(10);
  });

  it("원지에 정확히 맞아떨어지는 발주량은 정확히 1연으로 충족된다", () => {
    // 800x1000 원지에 400x500 품목은 회전 없이 2열x2행=4개/장으로 딱 맞는다.
    // 500장(1연) 기준으로 정확히 2000개를 발주하면 남는 것 없이 1연으로 끝난다.
    const engine = new NestEngine();
    engine.sheetWidth = 800;
    engine.sheetHeight = 1000;
    const result = engine.calculate([{ name: "A", width: 400, height: 500, orderQty: 2000 }]);

    expect(result.fulfilled).toBe(true);
    expect(result.totalSheet).toBe(1); // 1연 구매
    expect(result.totalPaper).toBe(500); // 500장 사용
    expect(result.totalProd).toBe(2000);
    expect(result.overProd).toBe(0);
    expect(result.remaining["A"]).toBe(0);
    expect(result.layouts).toHaveLength(1);
    expect(result.layouts[0].sheetCount).toBe(500);
  });

  it("발주량이 한 연보다 적어도 최소 1연 단위로만 찍는다 (재단 세팅 규칙)", () => {
    const engine = new NestEngine();
    engine.sheetWidth = 800;
    engine.sheetHeight = 1000;
    const result = engine.calculate([{ name: "A", width: 400, height: 500, orderQty: 10 }]);

    expect(result.fulfilled).toBe(true);
    expect(result.totalSheet).toBe(1);
    expect(result.totalPaper).toBe(500);
    expect(result.remaining["A"]).toBe(0);
    // 필요한 것보다 많이 나오는 만큼은 전부 초과생산으로 잡힌다.
    expect(result.totalProd).toBeGreaterThanOrEqual(10);
    expect(result.overProd).toBe(result.totalProd - 10);
  });

  it("두 품목을 같이 발주해도 각 품목의 발주량을 모두 충족한다", () => {
    const engine = new NestEngine();
    engine.sheetWidth = 788;
    engine.sheetHeight = 1091;
    const result = engine.calculate([
      { name: "A", width: 300, height: 400, orderQty: 1000 },
      { name: "B", width: 250, height: 350, orderQty: 800 },
    ]);

    expect(result.fulfilled).toBe(true);
    expect(result.remaining["A"]).toBe(0);
    expect(result.remaining["B"]).toBe(0);

    const producedA = result.layouts.reduce(
      (sum, l) => sum + l.items.filter((it) => it.name === "A").length * l.sheetCount,
      0
    );
    const producedB = result.layouts.reduce(
      (sum, l) => sum + l.items.filter((it) => it.name === "B").length * l.sheetCount,
      0
    );
    expect(producedA).toBeGreaterThanOrEqual(1000);
    expect(producedB).toBeGreaterThanOrEqual(800);
  });

  it("모든 배치는 500장(1연) 단위로만 사용한다", () => {
    const engine = new NestEngine();
    engine.sheetWidth = 788;
    engine.sheetHeight = 1091;
    const result = engine.calculate([{ name: "A", width: 300, height: 400, orderQty: 12345 }]);

    for (const layout of result.layouts) {
      expect(layout.sheetCount % 500).toBe(0);
    }
  });

  it("어떤 배치도 조각끼리 겹치지 않는다 (splitRect가 자유 공간을 잘못 잘라 겹침이 생기면 실패)", () => {
    const engine = new NestEngine();
    engine.sheetWidth = 788;
    engine.sheetHeight = 1091;
    const result = engine.calculate([
      { name: "610x690", width: 610, height: 690, orderQty: 1000 },
      { name: "405x370", width: 405, height: 370, orderQty: 4000 },
      { name: "305x340", width: 305, height: 340, orderQty: 3000 },
    ]);

    for (const layout of result.layouts) {
      for (let i = 0; i < layout.items.length; i++) {
        for (let j = i + 1; j < layout.items.length; j++) {
          const a = layout.items[i];
          const b = layout.items[j];
          const overlaps = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
          expect(overlaps).toBe(false);
        }
      }
      // 사용률이 100%를 넘는 것도 겹침의 또 다른 징후다.
      expect(layout.margin.usage).toBeLessThanOrEqual(100);
    }
  });

  it("610x690 하나 옆에 405x370을 두 개까지 붙여 배치할 수 있다 (실제 발견된 splitRect 버그 회귀 테스트)", () => {
    // 610x690을 눕혀서(690x610) 놓으면 아래에 788x481 공간이 남고, 거기에
    // 405x370을 눕혀서(370x405) 두 개(370+370=740<=788) 나란히 들어간다
    // (커버리지 83.82%). 예전 버그는 이 "아래쪽 남는 공간"의 폭을 방금 놓은
    // 조각의 폭(690)만큼만 남겨서, 두 번째 자리가 탐색 자체가 안 됐다.
    const engine = new NestEngine();
    engine.sheetWidth = 788;
    engine.sheetHeight = 1091;
    const result = engine.calculate([
      { name: "610x690", width: 610, height: 690, orderQty: 500 },
      { name: "405x370", width: 405, height: 370, orderQty: 1000 },
    ]);

    const bestUsage = Math.max(...result.layouts.map((l) => l.margin.usage));
    expect(bestUsage).toBeGreaterThanOrEqual(83);
  });

  it("코어 품목 3종 이상이 한 장에 섞이면 사용률을 85%로 상한한다 (길로틴 재단 불가 배치 억제)", () => {
    // 3종 이상 섞인 배치는 절단선이 어긋나서 대량 길로틴 재단이 안 되므로,
    // 실제 사용률이 85%를 넘어도 선택 점수/리포트 양쪽에서 85%까지만
    // 인정해야 한다(사용자 지적: "3조합 이상일경우는 그냥 85프로 사용률로
    // 제한하자").
    type PrivateEngine = {
      cappedUsageFraction: (
        pattern: { counts: Record<string, number> },
        rawFraction: number
      ) => number;
    };
    const engine = new NestEngine() as unknown as PrivateEngine;

    const threeItemPattern = { counts: { A: 1, B: 1, C: 1 } };
    expect(engine.cappedUsageFraction(threeItemPattern, 0.95)).toBeCloseTo(0.85, 5);

    // 코어 2종 이하는 상한이 적용되지 않는다.
    const twoItemPattern = { counts: { A: 1, B: 1 } };
    expect(engine.cappedUsageFraction(twoItemPattern, 0.95)).toBeCloseTo(0.95, 5);
  });

  it("305x340 하나만 발주해도 한 원지에 6개(2열x3행)까지 채운다", () => {
    const engine = new NestEngine();
    engine.sheetWidth = 788;
    engine.sheetHeight = 1091;
    const result = engine.calculate([{ name: "305x340", width: 305, height: 340, orderQty: 3000 }]);

    const bestLayout = result.layouts.reduce((best, l) =>
      l.margin.usage > best.margin.usage ? l : best
    );
    expect(bestLayout.items.length).toBe(6);
  });
});

describe("computeEffectiveReams", () => {
  function layout(overrides: Partial<NestLayout> & { itemNames: string[]; usage: number }): NestLayout {
    return {
      paperW: 788,
      paperH: 1091,
      items: overrides.itemNames.map((name) => ({
        name,
        x: 0,
        y: 0,
        w: 400,
        h: 400,
        prod: 500,
        color: "#000",
      })),
      margin: { usage: overrides.usage, right: 0, bottom: 0, area: 0 },
      sheetCount: overrides.sheetCount ?? 500,
      batchReams: 1,
      leftover: [],
    };
  }

  it("빈 배치 목록이면 0을 반환한다", () => {
    expect(computeEffectiveReams([])).toBe(0);
  });

  it("코어 품목이 3종 이상이면 사용률과 무관하게 1연 전부 인정한다", () => {
    const layouts = [layout({ itemNames: ["A", "B", "C"], usage: 10 })];
    expect(computeEffectiveReams(layouts)).toBe(1);
  });

  it("사용률이 60% 이상이면 코어 1~2종이어도 1연 전부 인정한다", () => {
    const layouts = [layout({ itemNames: ["A"], usage: 60 })];
    expect(computeEffectiveReams(layouts)).toBe(1);
  });

  it("사용률이 60% 미만이면 10%당 0.1연 단위로만 인정한다", () => {
    const layouts = [layout({ itemNames: ["A"], usage: 24.9 })];
    expect(computeEffectiveReams(layouts)).toBeCloseTo(0.2, 5);
  });

  it("여러 배치의 인정 연수를 합산한다", () => {
    const layouts = [
      layout({ itemNames: ["A", "B", "C"], usage: 10 }), // 1.0연
      layout({ itemNames: ["A"], usage: 24.9 }), // 0.2연
    ];
    expect(computeEffectiveReams(layouts)).toBeCloseTo(1.2, 5);
  });
});
