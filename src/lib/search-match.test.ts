import { describe, expect, it } from "vitest";
import { matchesSearch } from "./search-match";

describe("matchesSearch", () => {
  it("matches when the keyword is found in any field", () => {
    expect(matchesSearch("필터", "크라프트지", "필터 원지", null)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesSearch("kd238", "KD238VA - R3")).toBe(true);
  });

  it("returns false when no field contains the keyword", () => {
    expect(matchesSearch("없음", "크라프트지", "필터", undefined)).toBe(false);
  });

  it("treats null/undefined fields as empty instead of throwing", () => {
    expect(matchesSearch("abc", null, undefined)).toBe(false);
  });
});
