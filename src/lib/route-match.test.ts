import { describe, expect, it } from "vitest";
import { findByLongestPrefix } from "./route-match";

type Item = { prefix: string; label: string };

const items: Item[] = [
  { prefix: "/paper-calc", label: "모조지 계산" },
  { prefix: "/paper-calc/manual", label: "재단 배치 시뮬레이터" },
  { prefix: "/sales", label: "매출관리" },
];

describe("findByLongestPrefix", () => {
  it("배열 순서와 무관하게 가장 구체적인(긴) prefix를 우선한다", () => {
    expect(findByLongestPrefix(items, "/paper-calc/manual", (i) => i.prefix)?.label).toBe(
      "재단 배치 시뮬레이터"
    );
  });

  it("하위 경로가 아니면 상위 prefix로 매칭된다", () => {
    expect(findByLongestPrefix(items, "/paper-calc", (i) => i.prefix)?.label).toBe("모조지 계산");
    expect(findByLongestPrefix(items, "/paper-calc/view/123", (i) => i.prefix)?.label).toBe("모조지 계산");
  });

  it("아무것도 매칭되지 않으면 undefined를 반환한다", () => {
    expect(findByLongestPrefix(items, "/todos", (i) => i.prefix)).toBeUndefined();
  });

  it("배열 순서를 뒤집어도 결과가 같다(순서 독립성 확인)", () => {
    const reversed = [...items].reverse();
    expect(findByLongestPrefix(reversed, "/paper-calc/manual", (i) => i.prefix)?.label).toBe(
      "재단 배치 시뮬레이터"
    );
  });
});
