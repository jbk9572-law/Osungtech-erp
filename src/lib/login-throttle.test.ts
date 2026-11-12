import { beforeEach, describe, expect, it } from "vitest";
import {
  clientIpFromHeaders,
  recordLoginFailure,
  recordLoginSuccess,
  resetLoginThrottle,
  throttleRemainingSeconds,
} from "./login-throttle";

beforeEach(() => resetLoginThrottle());

describe("login-throttle", () => {
  it("같은 접속지+아이디로 5번 실패하면 막힌다", () => {
    for (let i = 0; i < 4; i++) recordLoginFailure("1.1.1.1", "kim");
    expect(throttleRemainingSeconds("1.1.1.1", "kim")).toBe(0);
    recordLoginFailure("1.1.1.1", "kim");
    expect(throttleRemainingSeconds("1.1.1.1", "kim")).toBeGreaterThan(0);
  });

  it("다른 접속지에서는 같은 아이디라도 막히지 않는다 (남을 잠그는 공격 방지)", () => {
    for (let i = 0; i < 10; i++) recordLoginFailure("6.6.6.6", "kim");
    expect(throttleRemainingSeconds("2.2.2.2", "kim")).toBe(0);
  });

  it("같은 접속지에서 아이디를 바꿔가며 30번 실패해도 막힌다", () => {
    for (let i = 0; i < 30; i++) recordLoginFailure("3.3.3.3", `user${i}`);
    expect(throttleRemainingSeconds("3.3.3.3", "brand-new")).toBeGreaterThan(0);
  });

  it("성공하면 그 아이디의 실패 횟수가 초기화된다", () => {
    for (let i = 0; i < 4; i++) recordLoginFailure("1.1.1.1", "kim");
    recordLoginSuccess("1.1.1.1", "kim");
    recordLoginFailure("1.1.1.1", "kim");
    expect(throttleRemainingSeconds("1.1.1.1", "kim")).toBe(0);
  });

  it("10분이 지나면 풀린다", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) recordLoginFailure("1.1.1.1", "kim", t0);
    expect(throttleRemainingSeconds("1.1.1.1", "kim", t0 + 1000)).toBeGreaterThan(0);
    expect(throttleRemainingSeconds("1.1.1.1", "kim", t0 + 10 * 60 * 1000 + 1)).toBe(0);
  });

  it("아이디 대소문자는 같은 것으로 센다", () => {
    for (let i = 0; i < 5; i++) recordLoginFailure("1.1.1.1", i % 2 ? "KIM" : "kim");
    expect(throttleRemainingSeconds("1.1.1.1", "Kim")).toBeGreaterThan(0);
  });

  it("X-Forwarded-For 첫 값을 접속지로 쓴다", () => {
    const h = new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" });
    expect(clientIpFromHeaders(h)).toBe("9.9.9.9");
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
