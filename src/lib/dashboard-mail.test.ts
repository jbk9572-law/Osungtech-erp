import { describe, expect, it } from "vitest";
import { mailTimeLabel } from "./dashboard-mail";

describe("mailTimeLabel", () => {
  const now = new Date("2026-11-13T05:00:00Z"); // 한국 시간 11/13 14:00
  it("오늘 온 메일은 시각으로 보여준다(한국 시간)", () => {
    expect(mailTimeLabel("2026-11-13T01:42:00Z", now)).toBe("10:42");
  });
  it("이전 메일은 월/일로 보여준다", () => {
    expect(mailTimeLabel("2026-11-11T03:00:00Z", now)).toBe("11/11");
  });
  it("시각이 없거나 이상하면 빈 문자열", () => {
    expect(mailTimeLabel(null, now)).toBe("");
    expect(mailTimeLabel("nope", now)).toBe("");
  });
});
