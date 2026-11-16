import { describe, expect, it } from "vitest";
import { formatBoxCount, formatPackageQty, formatQuantityWithBoxes, packageUnitLabel } from "./package-qty";

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

  it("unit을 넘기면 '수량 단위 (N박스)' 순서로 붙인다", () => {
    expect(formatQuantityWithBoxes(500, 50, "EA")).toBe("500 EA (10박스)");
  });

  it("unit을 넘겨도 포장수량이 없으면 '수량 단위'만 보여준다", () => {
    expect(formatQuantityWithBoxes(500, null, "EA")).toBe("500 EA");
  });
});

describe("packageUnitLabel / 박스·포 라벨", () => {
  it("리터 계열 단위(L, ML, KL, 18L, 20 L)는 포", () => {
    for (const u of ["L", "l", "ML", "KL", "18L", "20 L", "1.5L", " L "]) expect(packageUnitLabel(u)).toBe("포");
  });
  it("ROLL처럼 L로 끝나도 글자가 더 붙은 단위와 그 밖의 단위는 박스", () => {
    for (const u of ["ROLL", "EA", "KG", "BOX", "SET", "M", "", null, undefined]) expect(packageUnitLabel(u as string | null | undefined)).toBe("박스");
  });
  it("formatBoxCount는 단위에 따라 박스/포를 붙인다", () => {
    expect(formatBoxCount(100, 50, "EA")).toBe("2박스");
    expect(formatBoxCount(100, 50, "L")).toBe("2포");
    expect(formatBoxCount(100, 50)).toBe("2박스");
    expect(formatBoxCount(100, 0, "L")).toBeNull();
  });
  it("formatQuantityWithBoxes도 단위에 따라 포로 표시한다", () => {
    expect(formatQuantityWithBoxes(500, 50, "L")).toBe("500 L (10포)");
    expect(formatQuantityWithBoxes(240, 12, "ROLL")).toBe("240 ROLL (20박스)");
  });
});
