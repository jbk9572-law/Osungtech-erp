import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { compareScreenshots } from "./visual-compare";

function solid(w: number, h: number, rgba: [number, number, number, number]): Buffer {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) png.data.set(rgba, i * 4);
  return PNG.sync.write(png);
}

describe("compareScreenshots", () => {
  it("같은 이미지는 차이가 0이다", () => {
    const a = solid(20, 20, [255, 255, 255, 255]);
    const r = compareScreenshots(a, a);
    expect(r.ratio).toBe(0);
    expect(r.diffPng).toBeNull();
  });
  it("색이 다르면 차이 비율이 크게 나온다", () => {
    const r = compareScreenshots(solid(10, 10, [255, 255, 255, 255]), solid(10, 10, [0, 0, 0, 255]));
    expect(r.ratio).toBe(1);
    expect(r.diffPng).not.toBeNull();
  });
  it("눈에 안 보이는 아주 작은 색 차이(안티앨리어싱 수준)는 무시한다", () => {
    const r = compareScreenshots(solid(10, 10, [255, 255, 255, 255]), solid(10, 10, [253, 253, 253, 255]));
    expect(r.ratio).toBe(0);
  });
  it("크기가 다르면 화면 구성이 달라진 것으로 보고 완전히 다름(1)으로 친다", () => {
    const r = compareScreenshots(solid(10, 10, [255, 255, 255, 255]), solid(10, 12, [255, 255, 255, 255]));
    expect(r.ratio).toBe(1);
    expect(r.sameSize).toBe(false);
  });
});
