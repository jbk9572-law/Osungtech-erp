import { describe, expect, it } from "vitest";
import { calcStatutoryAnnualLeaveDays, leavePromotionWindow, nextLeaveExpiryDate } from "./leave-accrual";

describe("calcStatutoryAnnualLeaveDays", () => {
  it("입사 당일은 0일", () => {
    expect(calcStatutoryAnnualLeaveDays("2026-01-10", "2026-01-10")).toBe(0);
  });

  it("입사 1개월 개근 후 1일", () => {
    expect(calcStatutoryAnnualLeaveDays("2026-01-10", "2026-02-10")).toBe(1);
  });

  it("입사 11개월 후 11일(월차 상한)", () => {
    expect(calcStatutoryAnnualLeaveDays("2026-01-10", "2026-12-10")).toBe(11);
  });

  it("만 1년 미만 마지막날(11개월+29일)까지는 여전히 11일에서 안 늘어남", () => {
    expect(calcStatutoryAnnualLeaveDays("2026-01-10", "2027-01-09")).toBe(11);
  });

  it("만 1년 채운 날부터 15일", () => {
    expect(calcStatutoryAnnualLeaveDays("2026-01-10", "2027-01-10")).toBe(15);
  });

  it("만 2년차도 여전히 15일(3년째부터 가산)", () => {
    expect(calcStatutoryAnnualLeaveDays("2026-01-10", "2028-01-10")).toBe(15);
  });

  it("만 3년째부터 16일로 가산", () => {
    expect(calcStatutoryAnnualLeaveDays("2026-01-10", "2029-01-10")).toBe(16);
  });

  it("만 4년째는 3년째와 동일(16일, 2년 단위 가산)", () => {
    expect(calcStatutoryAnnualLeaveDays("2026-01-10", "2030-01-10")).toBe(16);
  });

  it("만 5년째 17일로 한 번 더 가산", () => {
    expect(calcStatutoryAnnualLeaveDays("2026-01-10", "2031-01-10")).toBe(17);
  });

  it("장기근속자는 25일 상한에 걸림", () => {
    // 만 21년째: 15 + floor(20/2) = 25 → 상한과 정확히 일치
    expect(calcStatutoryAnnualLeaveDays("2000-01-10", "2021-01-10")).toBe(25);
    // 만 30년째도 상한 25일을 넘지 않음
    expect(calcStatutoryAnnualLeaveDays("2000-01-10", "2030-01-10")).toBe(25);
  });

  it("2/29 입사자의 평년 기념일은 2/28로 보정된다", () => {
    expect(calcStatutoryAnnualLeaveDays("2024-02-29", "2025-03-01")).toBe(15);
  });
});

describe("nextLeaveExpiryDate", () => {
  it("입사 첫해에는 첫 입사기념일이 사용기한", () => {
    expect(nextLeaveExpiryDate("2026-01-10", "2026-06-01")).toBe("2027-01-10");
  });

  it("입사기념일을 막 지난 시점은 그 다음 기념일이 사용기한", () => {
    expect(nextLeaveExpiryDate("2026-01-10", "2027-01-10")).toBe("2028-01-10");
  });
});

describe("leavePromotionWindow", () => {
  it("사용기한 기준 6개월전/2개월전을 정확히 계산한다", () => {
    const window = leavePromotionWindow("2026-01-10", "2026-06-01");
    expect(window.expiryDate).toBe("2027-01-10");
    expect(window.firstNoticeDate).toBe("2026-07-10");
    expect(window.secondNoticeDate).toBe("2026-11-10");
  });
});
