import { describe, expect, it } from "vitest";
import { createRowDetailCache } from "./row-detail-cache";

describe("createRowDetailCache", () => {
  it("시간 안에는 기억하고, 지나면 잊는다", () => {
    let t = 1000;
    const c = createRowDetailCache<string>(30_000, () => t);
    c.set("a", "값");
    t += 29_999;
    expect(c.get("a")).toBe("값");
    t += 2;
    expect(c.get("a")).toBeUndefined();
  });
  it("없는 키는 undefined, clear 하면 전부 비운다", () => {
    const c = createRowDetailCache<number>(1000);
    expect(c.get("x")).toBeUndefined();
    c.set("x", 1);
    c.clear();
    expect(c.get("x")).toBeUndefined();
  });
  it("null 같은 '조회 실패' 값도 기억할 수 있다(undefined와 구분)", () => {
    const c = createRowDetailCache<null>(1000);
    c.set("k", null);
    expect(c.get("k")).toBeNull();
  });
});
