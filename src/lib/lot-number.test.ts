import { describe, expect, it } from "vitest";
import { normalizeLotNumber } from "./lot-number";

describe("normalizeLotNumber", () => {
  it("소문자를 대문자로 바꾼다", () => {
    expect(normalizeLotNumber("lot-a")).toBe("LOT-A");
  });

  it("공백을 전부 없앤다", () => {
    expect(normalizeLotNumber("LOT A 01")).toBe("LOTA01");
  });

  it("빈 문자열은 그대로 빈 문자열이다", () => {
    expect(normalizeLotNumber("")).toBe("");
  });
});
