import { beforeEach, describe, expect, it } from "vitest";
import { getModalOrigin, markModalOpen, recordPageUrl, resetModalOriginForTest } from "./modal-origin";

// 모달 닫기 목적지 — 실제로 지적된 순서를 그대로 재현한다. (모달 셸은 마운트 때 markModalOpen, TabBar는 주소가 바뀔 때 recordPageUrl)
function visit(url: string) {
  recordPageUrl(url);
}
function openModal(url: string) {
  recordPageUrl(url);
  markModalOpen(url.split("?")[0]);
}

describe("getModalOrigin", () => {
  beforeEach(() => resetModalOriginForTest());

  it("메인 화면에서 연 모달은 메인 화면으로 돌아간다", () => {
    visit("/dashboard");
    openModal("/sales/new");
    expect(getModalOrigin()).toBe("/dashboard");
  });

  it("목록에서 연 모달은 그 목록(조회조건 포함)으로 돌아간다", () => {
    visit("/sales?from=2026-11-01&q=abc");
    openModal("/sales/new");
    expect(getModalOrigin()).toBe("/sales?from=2026-11-01&q=abc");
  });

  it("입력 모달 → (저장) → 상세 모달로 바뀌어도 처음 열었던 화면으로 돌아간다(상세에서 X → 입력 모달이 다시 뜨던 버그)", () => {
    visit("/sales");
    openModal("/sales/new");
    openModal("/sales/9f1c2d3e");
    expect(getModalOrigin()).toBe("/sales");
  });

  it("메인 → 입력 모달 → 상세 모달이어도 메인으로 돌아간다", () => {
    visit("/dashboard");
    openModal("/sales/new");
    openModal("/sales/9f1c2d3e");
    expect(getModalOrigin()).toBe("/dashboard");
  });

  it("모달 → 모달(수정) → 모달(상세)처럼 여러 번 바뀌어도 모달이 아닌 마지막 화면을 가리킨다", () => {
    visit("/purchases");
    openModal("/purchases/new");
    openModal("/purchases/abc");
    openModal("/purchases/abc/edit");
    expect(getModalOrigin()).toBe("/purchases");
  });

  it("방문 기록이 없으면(처음부터 모달 주소) null", () => {
    openModal("/sales/new");
    expect(getModalOrigin()).toBeNull();
  });

  it("같은 주소가 연속으로 기록돼도 한 번만 센다", () => {
    visit("/dashboard");
    openModal("/sales/new");
    recordPageUrl("/sales/new");
    expect(getModalOrigin()).toBe("/dashboard");
  });

  it("모달을 닫고 다른 화면을 거쳐 다시 열면 그 화면으로 돌아간다", () => {
    visit("/dashboard");
    openModal("/sales/new");
    visit("/dashboard");
    visit("/purchases");
    openModal("/purchases/new");
    expect(getModalOrigin()).toBe("/purchases");
  });
});
