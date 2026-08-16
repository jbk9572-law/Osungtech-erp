import { describe, expect, it } from "vitest";
import { nextArmedKey } from "./use-confirm-twice";

describe("nextArmedKey", () => {
  it("처음 누르면 확인만 걸리고(confirmed=false) 해당 key가 armed된다", () => {
    expect(nextArmedKey<string>(null, "confirm")).toEqual({ next: "confirm", confirmed: false });
  });

  it("같은 key를 다시 누르면 confirmed=true이고 상태가 초기화된다", () => {
    expect(nextArmedKey<string>("confirm", "confirm")).toEqual({ next: null, confirmed: true });
  });

  it("다른 key를 누르면 이전 확인은 풀리고 새 key만 armed된다(confirmed=false)", () => {
    expect(nextArmedKey<string>("row-1", "row-2")).toEqual({ next: "row-2", confirmed: false });
  });
});
