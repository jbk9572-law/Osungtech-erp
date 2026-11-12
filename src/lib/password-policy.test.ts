import { describe, expect, it } from "vitest";
import { isPasswordLongEnough, MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT_MESSAGE } from "./password-policy";

describe("password-policy", () => {
  it("최소 길이 경계", () => {
    expect(isPasswordLongEnough("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
    expect(isPasswordLongEnough("a".repeat(MIN_PASSWORD_LENGTH))).toBe(true);
    expect(PASSWORD_TOO_SHORT_MESSAGE).toContain(String(MIN_PASSWORD_LENGTH));
  });
  it("앱이 자동으로 만드는 비밀번호(10자)와 개발 시드 비밀번호는 정책을 통과한다", () => {
    expect(isPasswordLongEnough("a1b2c3d4e5")).toBe(true);
    expect(isPasswordLongEnough("DevSeed!2026Elvonix")).toBe(true);
  });
});
