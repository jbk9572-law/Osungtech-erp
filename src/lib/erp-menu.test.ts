import { describe, expect, it } from "vitest";
import { getVisibleMenuGroups, getVisibleMenuItems } from "./erp-menu";

describe("getVisibleMenuGroups", () => {
  it("관리자가 아니면 adminOnly 항목을 뺀다", () => {
    const groups = getVisibleMenuGroups([], false);
    const settings = groups.find((g) => g.label === "환경설정");
    expect(settings?.items.some((i) => i.label === "조직도 관리")).toBe(false);
    expect(settings?.items.some((i) => i.label === "비밀번호 변경")).toBe(true);
  });

  it("모든 항목이 adminOnly인 그룹은 관리자가 아니면 그룹째로 사라진다", () => {
    const groups = getVisibleMenuGroups([], false);
    expect(groups.some((g) => g.label === "시스템관리")).toBe(false);
  });

  it("관리자는 adminOnly 항목도 모두 본다", () => {
    const groups = getVisibleMenuGroups([], true);
    expect(groups.some((g) => g.label === "시스템관리")).toBe(true);
    const settings = groups.find((g) => g.label === "환경설정");
    expect(settings?.items.some((i) => i.label === "조직도 관리")).toBe(true);
  });

  it("featureKey로 꺼진 그룹은 관리자 여부와 무관하게 빠진다", () => {
    const groups = getVisibleMenuGroups(["approvals"], true);
    expect(groups.some((g) => g.label === "전자결재")).toBe(false);
  });
});

describe("getVisibleMenuItems", () => {
  it("adminOnly 화면의 href는 비관리자 목록에 없다", () => {
    const items = getVisibleMenuItems([], false);
    expect(items.some((i) => i.href === "/settings/departments")).toBe(false);
    expect(items.some((i) => i.href === "/settings/users")).toBe(false);
  });

  it("공유 결재선처럼 관리자 전용이 아닌 화면은 비관리자에게도 보인다", () => {
    const items = getVisibleMenuItems([], false);
    expect(items.some((i) => i.href === "/approvals/matrix")).toBe(true);
  });

  it("인사관리 중 관리자 전용 화면(급여명세 등)은 비관리자 목록에 없다", () => {
    const items = getVisibleMenuItems([], false);
    expect(items.some((i) => i.href === "/hr/payroll")).toBe(false);
    expect(items.some((i) => i.href === "/hr/attendance")).toBe(true);
  });
});
