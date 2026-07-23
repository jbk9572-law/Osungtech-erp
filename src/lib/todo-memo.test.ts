import { describe, expect, it } from "vitest";
import { countTodoMemoLines, formatTodoMemoLine, parseTodoMemoLines } from "./todo-memo";

describe("formatTodoMemoLine", () => {
  it("규격이 있으면 괄호로 묶는다", () => {
    expect(formatTodoMemoLine("모조지", "510×670", 4000)).toBe("모조지 (510×670) : 4,000");
  });

  it("규격이 없으면 괄호 없이 이름과 수량만 적는다", () => {
    expect(formatTodoMemoLine("아트지", "", 2000)).toBe("아트지 : 2,000");
  });
});

describe("parseTodoMemoLines", () => {
  it("품목명 (규격) : 수량 형식을 파싱한다", () => {
    expect(parseTodoMemoLines("모조지 (510×670) : 4,000")).toEqual([
      { raw: "모조지 (510×670) : 4,000", name: "모조지", spec: "510×670", qty: "4,000" },
    ]);
  });

  it("규격 없는 줄도 파싱한다", () => {
    expect(parseTodoMemoLines("아트지 : 2,000")).toEqual([
      { raw: "아트지 : 2,000", name: "아트지", spec: null, qty: "2,000" },
    ]);
  });

  it("여러 줄을 각각 파싱하고 빈 줄은 건너뛴다", () => {
    const memo = "모조지 (510×670) : 4,000\n\n간지 (610×780) : 10,000";
    expect(parseTodoMemoLines(memo)).toEqual([
      { raw: "모조지 (510×670) : 4,000", name: "모조지", spec: "510×670", qty: "4,000" },
      { raw: "간지 (610×780) : 10,000", name: "간지", spec: "610×780", qty: "10,000" },
    ]);
  });

  it("형식에 안 맞는 자유 텍스트는 raw 그대로 name에 담는다", () => {
    expect(parseTodoMemoLines("내일까지 견적서 보내기")).toEqual([
      { raw: "내일까지 견적서 보내기", name: "내일까지 견적서 보내기", spec: null, qty: null },
    ]);
  });

  it("빈 문자열/null/undefined는 빈 배열을 반환한다", () => {
    expect(parseTodoMemoLines("")).toEqual([]);
    expect(parseTodoMemoLines(null)).toEqual([]);
    expect(parseTodoMemoLines(undefined)).toEqual([]);
  });
});

describe("countTodoMemoLines", () => {
  it("비어있지 않은 줄 수를 센다", () => {
    expect(countTodoMemoLines("첫째\n\n둘째\n셋째")).toBe(3);
  });

  it("빈 문자열/null/undefined는 0을 반환한다", () => {
    expect(countTodoMemoLines("")).toBe(0);
    expect(countTodoMemoLines(null)).toBe(0);
    expect(countTodoMemoLines(undefined)).toBe(0);
  });
});
