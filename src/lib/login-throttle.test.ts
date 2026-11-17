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
  it("한도에 닿는 순간에만 잠금 종류를 돌려준다(이미 잠긴 뒤 추가 실패는 null)", () => {
    const kinds = [];
    for (let i = 0; i < 7; i++) kinds.push(recordLoginFailure("1.1.1.1", "kim"));
    expect(kinds).toEqual([null, null, null, null, "id", null, null]);
  });

  it("한 계정에 접속지를 바꿔 20번 실패하면 account 잠금을 알린다", () => {
    let last = null;
    for (let i = 0; i < 20; i++) last = recordLoginFailure(`9.9.9.${i}`, "boss");
    expect(last).toBe("account");
  });

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

describe("login-throttle: 접속지를 바꿔 가며 한 계정을 노리는 공격", () => {
  it("접속지(IP/조작한 헤더)를 매번 바꿔도 같은 계정에 20번 실패하면 막힌다", () => {
    for (let i = 0; i < 19; i++) recordLoginFailure(`10.0.0.${i}`, "kim");
    expect(throttleRemainingSeconds("10.9.9.9", "kim")).toBe(0);
    recordLoginFailure("10.0.0.99", "kim");
    expect(throttleRemainingSeconds("10.8.8.8", "kim")).toBeGreaterThan(0); // 아직 한 번도 안 쓴 새 접속지도 막힌다
  });
  it("다른 계정은 영향을 받지 않는다", () => {
    for (let i = 0; i < 25; i++) recordLoginFailure(`10.1.0.${i}`, "kim");
    expect(throttleRemainingSeconds("10.1.0.200", "lee")).toBe(0);
  });
  it("대문자·소문자만 바꿔 우회할 수 없다", () => {
    for (let i = 0; i < 20; i++) recordLoginFailure(`10.2.0.${i}`, i % 2 ? "KIM" : "kim");
    expect(throttleRemainingSeconds("10.2.9.9", "Kim")).toBeGreaterThan(0);
  });
  it("로그인에 성공하면 계정 카운터도 풀린다", () => {
    for (let i = 0; i < 20; i++) recordLoginFailure(`10.3.0.${i}`, "kim");
    recordLoginSuccess("10.3.9.9", "kim");
    expect(throttleRemainingSeconds("10.3.9.9", "kim")).toBe(0);
  });
  it("10분이 지나면 풀린다(공격으로 잠겨도 영구 잠금은 아님)", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 20; i++) recordLoginFailure(`10.4.0.${i}`, "kim", t0);
    expect(throttleRemainingSeconds("10.4.9.9", "kim", t0 + 1000)).toBeGreaterThan(0);
    expect(throttleRemainingSeconds("10.4.9.9", "kim", t0 + 11 * 60 * 1000)).toBe(0);
  });
});
