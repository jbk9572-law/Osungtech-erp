import { describe, expect, it } from "vitest";
import { formatPackageQty, formatQuantityWithBoxes } from "./package-qty";

describe("formatPackageQty", () => {
  it("포장수량 * 박스수 형태로 표시한다", () => {
    expect(formatPackageQty(50, 1000)).toBe("50*20");
  });

  it("박스수가 정수가 아니면 소수 둘째자리까지 보여준다", () => {
    expect(formatPackageQty(50, 1030)).toBe("50*20.60");
  });

  it("포장수량이 없으면 '-'를 반환한다", () => {
    expect(formatPackageQty(null, 100)).toBe("-");
    expect(formatPackageQty(undefined, 100)).toBe("-");
    expect(formatPackageQty(0, 100)).toBe("-");
  });

  it("수량이 0 이하면 박스수를 0으로 표시한다", () => {
    expect(formatPackageQty(50, 0)).toBe("50*0");
  });
});

describe("formatQuantityWithBoxes", () => {
  it("수량과 박스 환산을 함께 보여준다", () => {
    expect(formatQuantityWithBoxes(500, 50)).toBe("500 (10박스)");
  });

  it("박스수가 정수가 아니면 소수 첫째자리까지 보여준다", () => {
    expect(formatQuantityWithBoxes(525, 50)).toBe("525 (10.5박스)");
  });

  it("포장수량이 없으면 수량만 보여준다", () => {
    expect(formatQuantityWithBoxes(500, null)).toBe("500");
    expect(formatQuantityWithBoxes(500, 0)).toBe("500");
  });
});
