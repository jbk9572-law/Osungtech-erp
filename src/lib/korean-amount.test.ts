import { describe, expect, it } from "vitest";
import { koreanAmount, koreanAmountLine } from "./korean-amount";

describe("koreanAmount", () => {
  it("시안의 예: 4,015,000 → 사백일만오천", () => {
    expect(koreanAmount(4_015_000)).toBe("사백일만오천");
    expect(koreanAmountLine(4_015_000)).toBe("일금 사백일만오천원정");
  });
  it("0은 영, 1~9와 자리 단위", () => {
    expect(koreanAmount(0)).toBe("영");
    expect(koreanAmount(1)).toBe("일");
    expect(koreanAmount(10)).toBe("일십");
    expect(koreanAmount(100)).toBe("일백");
    expect(koreanAmount(1000)).toBe("일천");
  });
  it("만·억 단위와 0이 낀 자리를 건너뛴다", () => {
    expect(koreanAmount(10_000)).toBe("일만");
    expect(koreanAmount(1_000_000)).toBe("일백만");
    expect(koreanAmount(100_000_000)).toBe("일억");
    expect(koreanAmount(123_456_789)).toBe("일억이천삼백사십오만육천칠백팔십구");
    expect(koreanAmount(100_000_001)).toBe("일억일");
  });
  it("반품 등 음수는 마이너스를 붙이고, 소수는 반올림한다", () => {
    expect(koreanAmount(-50_000)).toBe("마이너스 오만");
    expect(koreanAmount(999.6)).toBe("일천");
  });
  it("숫자가 아니면 빈 글자", () => {
    expect(koreanAmount(Number.NaN)).toBe("");
  });
});
