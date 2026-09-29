import { describe, expect, it } from "vitest";
import { getVisibleMenuGroups, getVisibleMenuItems, MENU_ITEMS } from "./erp-menu";

describe("getVisibleMenuGroups", () => {
  it("관리자가 아니면 adminOnly 항목을 뺀다", () => {
    const groups = getVisibleMenuGroups([], false);
    const settings = groups.find((g) => g.label === "환경설정");
    expect(settings?.items.some((i) => i.label === "조직도 관리")).toBe(false);
    expect(settings?.items.some((i) => i.label === "비밀번호 변경")).toBe(true);
  });

  it("관리자는 adminOnly 항목도 모두 본다", () => {
    const groups = getVisibleMenuGroups([], true);
    const settings = groups.find((g) => g.label === "환경설정");
    expect(settings?.items.some((i) => i.label === "조직도 관리")).toBe(true);
  });

  it("그룹 안의 모든 항목이 꺼지면 그룹째로 사라진다", () => {
    const groups = getVisibleMenuGroups(["/calendar", "/todos"], true);
    expect(groups.some((g) => g.label === "일정관리")).toBe(false);
  });

  it("항목 단위 featureKey로 꺼진 화면만 빠지고, 같은 그룹의 다른 featureKey 항목은 남는다", () => {
    // 대메뉴 통폐합(전자결재+공문관리+게시판+메일함 → 그룹웨어)으로 이
    // 그룹 하나에 approvals/official_documents/mail 등 여러 featureKey가
    // 섞여 있다 — 하나만 꺼도 그룹 전체가 아니라 그 featureKey 항목만
    // 빠져야 한다.
    const groups = getVisibleMenuGroups(["approvals"], true);
    const groupware = groups.find((g) => g.label === "그룹웨어");
    expect(groupware?.items.some((i) => i.href === "/approvals")).toBe(false);
    expect(groupware?.items.some((i) => i.href === "/official-documents")).toBe(true);
  });

  it("그룹 안의 모든 featureKey 항목이 꺼져도 featureKey 없는 다른 항목(게시판 등)이 있으면 그룹은 남는다", () => {
    const groups = getVisibleMenuGroups(["approvals", "official_documents", "mail"], true);
    const groupware = groups.find((g) => g.label === "그룹웨어");
    expect(groupware).toBeTruthy();
    expect(groupware?.items.some((i) => i.href === "/board")).toBe(true);
    expect(groupware?.items.some((i) => i.href === "/approvals")).toBe(false);
  });

  it("매출관리 안의 crm 항목(영업활동/견적서)만 featureKey로 개별적으로 꺼진다", () => {
    // 원래 영업관리(crm)라는 별도 그룹이었는데 매출관리로 흡수됐다 —
    // 항목 단위 featureKey 덕에 매출관리 나머지는 그대로 남아야 한다.
    const groups = getVisibleMenuGroups(["crm"], true);
    const sales = groups.find((g) => g.label === "매출관리");
    expect(sales?.items.some((i) => i.href === "/sales")).toBe(true);
    expect(sales?.items.some((i) => i.href === "/quotes")).toBe(false);
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

  it("hidden 항목(창고 이동 이력)은 트리메뉴/빠른검색 목록에 없다", () => {
    const items = getVisibleMenuItems([], true);
    expect(items.some((i) => i.href === "/inventory/transfers")).toBe(false);
    expect(items.some((i) => i.href === "/inventory/warehouses")).toBe(true);
  });
});

describe("MENU_ITEMS", () => {
  it("hidden 항목도 타이틀바/최근메뉴 라벨 매칭을 위해 전체 목록엔 남아있다", () => {
    expect(MENU_ITEMS.some((i) => i.href === "/inventory/transfers")).toBe(true);
  });
});
