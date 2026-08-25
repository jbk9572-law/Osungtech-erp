import { describe, expect, it } from "vitest";
import { dashOrLeftAlign } from "./dash-align";

describe("dashOrLeftAlign", () => {
  it("값이 없으면 가운데 정렬 스타일을 반환한다", () => {
    expect(dashOrLeftAlign(null)).toEqual({ textAlign: "center" });
    expect(dashOrLeftAlign(undefined)).toEqual({ textAlign: "center" });
    expect(dashOrLeftAlign("")).toEqual({ textAlign: "center" });
  });

  it("값이 있으면 빈 스타일(원래 정렬 유지)을 반환한다", () => {
    expect(dashOrLeftAlign("규격")).toEqual({});
    expect(dashOrLeftAlign(0)).toEqual({ textAlign: "center" });
  });
});
