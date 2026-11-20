import { describe, expect, it } from "vitest";
import { createRowsHistory } from "./rows-history";

describe("createRowsHistory", () => {
  it("줄 추가·삭제(structural)는 항상 한 단계씩 쌓이고 순서대로 되돌아간다", () => {
    let t = 0;
    const h = createRowsHistory<string>({ now: () => t });
    h.record("A", true);
    t += 10;
    h.record("B", true);
    expect(h.undo("C")).toBe("B");
    expect(h.undo("B")).toBe("A");
    expect(h.undo("A")).toBeUndefined();
  });

  it("0.7초 안의 연속 수정은 한 단계로 합친다(한 글자씩 되돌리지 않는다)", () => {
    let t = 1000;
    const h = createRowsHistory<string>({ now: () => t });
    h.record("5", false); // 첫 수정 → 단계 생성(바뀌기 전 값 "5")
    t += 100;
    h.record("51", false); // 합쳐짐
    t += 100;
    h.record("512", false); // 합쳐짐
    expect(h.undo("5124")).toBe("5"); // 한 번에 처음 값으로
    expect(h.undo("5")).toBeUndefined();
  });

  it("0.7초 넘게 쉬었다가 고치면 새 단계", () => {
    let t = 1000;
    const h = createRowsHistory<string>({ now: () => t });
    h.record("a", false);
    t += 5000;
    h.record("b", false);
    expect(h.undo("c")).toBe("b");
    expect(h.undo("b")).toBe("a");
  });

  it("되돌리기 → 다시 실행, 되돌린 뒤 새로 고치면 다시 실행 기록이 지워진다", () => {
    let t = 0;
    const h = createRowsHistory<string>({ now: () => t });
    h.record("A", true);
    expect(h.undo("B")).toBe("A");
    expect(h.canRedo()).toBe(true);
    expect(h.redo("A")).toBe("B");
    expect(h.undo("B")).toBe("A");
    t += 10;
    h.record("A", true); // 새 수정
    expect(h.canRedo()).toBe(false);
  });

  it("줄 추가 직후 0.7초 안에 값을 쳐도 줄 추가와 합쳐지지 않는다", () => {
    let t = 1000;
    const h = createRowsHistory<string>({ now: () => t });
    h.record("1줄", true); // 줄 추가
    t += 50;
    h.record("2줄 빈칸", false); // 곧바로 값 입력
    expect(h.undo("2줄 입력")).toBe("2줄 빈칸"); // 값 입력만 먼저 되돌아가고
    expect(h.undo("2줄 빈칸")).toBe("1줄"); // 그다음에 줄 추가가 되돌아간다
  });

  it("되돌린 직후의 첫 수정은 합쳐지지 않고 새 단계", () => {
    let t = 1000;
    const h = createRowsHistory<string>({ now: () => t });
    h.record("a", false);
    expect(h.undo("b")).toBe("a");
    t += 50; // 0.7초 안이어도
    h.record("a", false);
    expect(h.canUndo()).toBe(true);
  });

  it("최대 단계 수를 넘기면 가장 오래된 것부터 버린다", () => {
    const h = createRowsHistory<number>({ max: 3, now: () => 0 });
    for (let i = 0; i < 5; i++) h.record(i, true);
    expect([h.undo(9), h.undo(9), h.undo(9), h.undo(9)]).toEqual([4, 3, 2, undefined]);
  });
});
