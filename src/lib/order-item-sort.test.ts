import { describe, expect, it } from "vitest";
import { orderItemsByLine } from "./order-item-sort";

type R = { id: string; order: string; line_no: number | null; at?: string };
const r = (id: string, order: string, line_no: number | null, at = ""): R => ({ id, order, line_no, at });

describe("orderItemsByLine", () => {
  it("한 전표 안의 품목을 입력 순서(line_no)로 정렬하고 전표(그룹) 순서는 받은 순서를 유지한다", () => {
    const rows = [r("b3", "B", 3), r("a2", "A", 2), r("b1", "B", 1), r("a1", "A", 1), r("b2", "B", 2)];
    expect(orderItemsByLine(rows, (x) => x.order).map((x) => x.id)).toEqual(["b1", "b2", "b3", "a1", "a2"]);
  });

  it("번호가 없는 품목은 뒤로, 같은 번호는 받은 순서를 유지한다", () => {
    const rows = [r("x", "A", null), r("y", "A", 2), r("z", "A", 2), r("w", "A", 1)];
    expect(orderItemsByLine(rows, (x) => x.order).map((x) => x.id)).toEqual(["w", "y", "z", "x"]);
  });

  it("groupKeyOf를 주면 전표 순서를 그 값(생성 시각) 오름차순으로 바로잡는다", () => {
    const rows = [r("b1", "B", 1, "2026-12-07T10:00"), r("a2", "A", 2, "2026-12-07T09:00"), r("a1", "A", 1, "2026-12-07T09:00")];
    expect(orderItemsByLine(rows, (x) => x.order, (x) => x.at).map((x) => x.id)).toEqual(["a1", "a2", "b1"]);
  });

  it("전표를 알 수 없는 줄은 맨 뒤에 그대로 둔다", () => {
    const rows = [r("n", "", 1), r("a1", "A", 1)];
    expect(orderItemsByLine(rows, (x) => x.order || null).map((x) => x.id)).toEqual(["a1", "n"]);
  });
});
