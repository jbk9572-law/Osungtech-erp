import { beforeEach, describe, expect, it } from "vitest";
import { NAV_GUARD_WINDOW_MS, resetNavigationGuard, shouldAllowNavigation } from "./nav-guard";

describe("nav-guard", () => {
  beforeEach(() => resetNavigationGuard());

  it("같은 주소로의 연타(더블클릭)는 첫 번째만 허용한다", () => {
    expect(shouldAllowNavigation("/sales/new", 1000)).toBe(true);
    expect(shouldAllowNavigation("/sales/new", 1100)).toBe(false);
    expect(shouldAllowNavigation("/sales/new", 1000 + NAV_GUARD_WINDOW_MS - 1)).toBe(false);
  });

  it("시간이 지나면 다시 허용한다(닫았다가 다시 여는 정상 사용)", () => {
    expect(shouldAllowNavigation("/sales/new", 1000)).toBe(true);
    expect(shouldAllowNavigation("/sales/new", 1000 + NAV_GUARD_WINDOW_MS)).toBe(true);
  });

  it("다른 주소는 서로 막지 않는다", () => {
    expect(shouldAllowNavigation("/sales/new", 1000)).toBe(true);
    expect(shouldAllowNavigation("/purchases/new", 1050)).toBe(true);
  });
});
