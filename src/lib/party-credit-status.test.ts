import { describe, expect, it } from "vitest";
import { partyCreditStatus } from "./party-credit-status";

describe("partyCreditStatus", () => {
  const today = "2026-11-19";
  it("잔액이 없거나 초과 입금이면 정상", () => {
    expect(partyCreditStatus(0, null, today)).toBe("ok");
    expect(partyCreditStatus(-500, "2026-01-01", today)).toBe("ok");
  });
  it("잔액이 있고 30일 미만이면 주의, 30일 이상이면 연체(경계 포함)", () => {
    expect(partyCreditStatus(1000, "2026-11-01", today)).toBe("caution");
    expect(partyCreditStatus(1000, "2026-10-20", today)).toBe("overdue");
    expect(partyCreditStatus(1000, "2026-10-21", today)).toBe("caution");
  });
  it("가장 오래된 미결제 날짜를 모르면 주의", () => {
    expect(partyCreditStatus(1000, null, today)).toBe("caution");
  });
});
