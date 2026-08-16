import { describe, expect, it } from "vitest";
import { nowInKst, todayKstStr, toKstDateStr } from "./kst-date";

describe("nowInKst", () => {
  it("UTC 시각에 9시간을 더한 Date를 돌려준다", () => {
    const utc = new Date("2026-01-01T00:00:00.000Z");
    expect(nowInKst(utc).getTime()).toBe(utc.getTime() + 9 * 60 * 60 * 1000);
  });
});

describe("todayKstStr", () => {
  it("UTC로 자정 직전(한국시간 오전 8~9시대)이면 한국 기준 날짜를 반환한다", () => {
    // UTC 2026-01-01 23:30 = KST 2026-01-02 08:30
    const utc = new Date("2026-01-01T23:30:00.000Z");
    expect(todayKstStr(utc)).toBe("2026-01-02");
  });

  it("UTC 오전 0~9시 사이(한국은 아직 전날 밤)에도 한국 기준 날짜를 반환한다", () => {
    // UTC 2026-01-02 12:00 = KST 2026-01-02 21:00 (같은 날짜)
    const utc = new Date("2026-01-02T12:00:00.000Z");
    expect(todayKstStr(utc)).toBe("2026-01-02");
  });

  it("UTC 자정 직후는 한국시간 오전 9시라 아직 날짜가 안 넘어간 경우를 검증한다", () => {
    // UTC 2026-01-02 00:00 = KST 2026-01-02 09:00
    const utc = new Date("2026-01-02T00:00:00.000Z");
    expect(todayKstStr(utc)).toBe("2026-01-02");
  });

  it("연말/연초 경계에서도 올바르게 넘어간다", () => {
    // UTC 2025-12-31 15:30 = KST 2026-01-01 00:30
    const utc = new Date("2025-12-31T15:30:00.000Z");
    expect(todayKstStr(utc)).toBe("2026-01-01");
  });
});

describe("toKstDateStr", () => {
  it("todayKstStr과 동일하게 동작한다", () => {
    const utc = new Date("2026-03-15T05:00:00.000Z");
    expect(toKstDateStr(utc)).toBe(todayKstStr(utc));
  });
});
