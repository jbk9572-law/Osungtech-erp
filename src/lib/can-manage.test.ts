import { describe, expect, it } from "vitest";
import { canManage } from "./can-manage";

describe("canManage", () => {
  it("관리자는 소유자와 무관하게 항상 허용된다", () => {
    expect(canManage("user-a", "user-b", true)).toBe(true);
    expect(canManage(null, "user-b", true)).toBe(true);
  });

  it("본인 소유 항목은 허용된다", () => {
    expect(canManage("user-a", "user-a", false)).toBe(true);
  });

  it("다른 사람 소유 항목은 관리자가 아니면 거부된다", () => {
    expect(canManage("user-a", "user-b", false)).toBe(false);
  });

  it("로그인하지 않았거나(currentUserId 없음) 소유자 정보가 없으면 거부된다", () => {
    expect(canManage("user-a", null, false)).toBe(false);
    expect(canManage(null, "user-a", false)).toBe(false);
  });
});
