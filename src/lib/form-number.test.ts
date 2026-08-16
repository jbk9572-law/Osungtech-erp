import { describe, expect, it } from "vitest";
import { numberOrDefault, numberOrNull } from "./form-number";

describe("numberOrDefault", () => {
  it("유효한 숫자 문자열은 숫자로 변환한다", () => {
    expect(numberOrDefault("42", 0)).toBe(42);
  });

  it("null이면 fallback을 반환한다", () => {
    expect(numberOrDefault(null, 7)).toBe(7);
  });

  it("숫자로 변환할 수 없는 값이면 fallback을 반환한다(NaN이 그대로 새지 않음)", () => {
    expect(numberOrDefault("abc", 7)).toBe(7);
  });

  // Number("")는 0이라 유효한 숫자로 취급되고, fallback 분기를 타지 않는다.
  // 실제 호출부(products/actions.ts)는 전부 fallback: 0을 쓰고 있어 결과가
  // 같아 보이지만, fallback이 0이 아닌 값으로 쓰이면 이 동작이 놀라울 수
  // 있어 여기 명시적으로 남겨둔다.
  it("빈 문자열은 Number('')=0으로 취급되어 fallback을 타지 않는다", () => {
    expect(numberOrDefault("", 7)).toBe(0);
  });
});

describe("numberOrNull", () => {
  it("유효한 숫자 문자열은 숫자로 변환한다", () => {
    expect(numberOrNull("42")).toBe(42);
  });

  it("null/빈 문자열/공백은 null을 반환한다", () => {
    expect(numberOrNull(null)).toBeNull();
    expect(numberOrNull("")).toBeNull();
    expect(numberOrNull("   ")).toBeNull();
  });

  it("숫자로 변환할 수 없는 값이면 null을 반환한다", () => {
    expect(numberOrNull("abc")).toBeNull();
  });
});
