import { describe, expect, it } from "vitest";
import { buildPrintOptionHref } from "./print-options";
import { anchorLeavesPath } from "./nav-start";

describe("buildPrintOptionHref", () => {
  it("바꾸는 옵션 하나만 덮어쓰고 나머지(back·lot 포함)는 그대로 가져간다", () => {
    const href = buildPrintOptionHref(
      "/sales/abc/print",
      { copies: "both", layout: "half", balance: "hide", lot: "show", back: "from=2026-01-01" },
      "layout",
      "full",
    );
    const qs = new URLSearchParams(href.split("?")[1]);
    expect(href.startsWith("/sales/abc/print?")).toBe(true);
    expect(qs.get("layout")).toBe("full");
    expect(qs.get("copies")).toBe("both");
    expect(qs.get("lot")).toBe("show");
    expect(qs.get("back")).toBe("from=2026-01-01");
  });

  it("아직 값이 없던 옵션도 추가하고, 빈 값·undefined는 버린다", () => {
    const href = buildPrintOptionHref("/p", { a: undefined, b: "" }, "copies", "receiver");
    expect(href).toBe("/p?copies=receiver");
  });
});

describe("anchorLeavesPath", () => {
  const here = "https://erp.example.com/sales/abc/print?copies=both";
  it("같은 경로에서 ?옵션만 바꾸면 화면을 떠나는 게 아니다", () => {
    expect(anchorLeavesPath("/sales/abc/print?copies=receiver&layout=full", here)).toBe(false);
    expect(anchorLeavesPath("#top", here)).toBe(false);
  });
  it("다른 경로로 가면 떠나는 것이다", () => {
    expect(anchorLeavesPath("/sales", here)).toBe(true);
    expect(anchorLeavesPath("/sales/abc", here)).toBe(true);
  });
  it("다른 사이트 링크는 이 판정 대상이 아니다", () => {
    expect(anchorLeavesPath("https://other.example.com/x", here)).toBe(false);
  });
});
