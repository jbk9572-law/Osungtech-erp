import { describe, expect, it } from "vitest";
import { positionOfRows } from "./grid-row-position";

describe("positionOfRows", () => {
  it("행이 없으면 null", () => {
    expect(positionOfRows([])).toBeNull();
    expect(positionOfRows([{ cells: 1, active: false }])).toBeNull();
  });

  it("고른 행의 순서와 전체 수", () => {
    expect(
      positionOfRows([
        { cells: 5, active: false },
        { cells: 5, active: true },
        { cells: 5, active: false },
      ]),
    ).toEqual({ index: 2, total: 3 });
  });

  it("고른 행이 없으면 index 0", () => {
    expect(positionOfRows([{ cells: 4, active: false }])).toEqual({ index: 0, total: 1 });
  });

  it("칸이 하나뿐인 줄(펼침·안내)은 세지 않고 순서에도 넣지 않는다", () => {
    expect(
      positionOfRows([
        { cells: 4, active: false },
        { cells: 1, active: false },
        { cells: 4, active: true },
      ]),
    ).toEqual({ index: 2, total: 2 });
  });
});
