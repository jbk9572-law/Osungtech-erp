import { describe, expect, it } from "vitest";
import { moveItem } from "./array-move";

describe("moveItem", () => {
  it("한 칸 위/아래로 옮긴다", () => {
    expect(moveItem(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });
  it("끝에서 더 못 가거나 없는 항목이면 그대로", () => {
    expect(moveItem(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], "z", 1)).toEqual(["a", "b"]);
  });
  it("원래 배열은 바꾸지 않는다", () => {
    const src = ["a", "b"];
    moveItem(src, "a", 1);
    expect(src).toEqual(["a", "b"]);
  });
});
