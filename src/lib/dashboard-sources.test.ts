import { describe, expect, it } from "vitest";
import { DEFAULT_SOURCE_SELECTION, MAX_TODO_TABS, normalizeSourceSelection } from "./dashboard-sources";

describe("normalizeSourceSelection", () => {
  it("저장값이 없거나 이상하면 기본 선택을 준다", () => {
    for (const raw of [null, undefined, 3, "x", []]) {
      expect(normalizeSourceSelection(raw)).toEqual(DEFAULT_SOURCE_SELECTION);
    }
  });
  it("모르는 id와 중복은 버리고 탭 개수를 제한한다", () => {
    const out = normalizeSourceSelection({ todo: ["todo", "todo", "evil", "lowStock", "approval", "overdue", "payable", "carryover", "announcement", "todo"], listA: "evil" });
    expect(out.todo).toEqual(["todo", "lowStock", "approval", "overdue", "payable", "carryover", "announcement"]);
    expect(out.todo.length).toBeLessThanOrEqual(MAX_TODO_TABS);
    // 예전에 저장된 목록 칸(listA/listB) 같은 모르는 키는 무시한다.
    expect(Object.keys(out).sort()).toEqual(["news", "todo"]);
  });
  it("탭을 전부 끈 선택(빈 배열)은 그대로 둔다", () => {
    expect(normalizeSourceSelection({ todo: [] }).todo).toEqual([]);
  });
});

describe("소식 탭 선택값", () => {
  it("저장값에 news가 없으면 기본(메일·공지·메모)을 쓰고, 있으면 모르는 값·중복을 버린다", async () => {
    const { normalizeSourceSelection } = await import("./dashboard-sources");
    expect(normalizeSourceSelection({ todo: ["todo"] }).news).toEqual(["mail", "announcement", "memo"]);
    expect(normalizeSourceSelection({ news: ["announcement", "announcement", "nope", "mail"] }).news).toEqual(["announcement", "mail"]);
    expect(normalizeSourceSelection({ news: [] }).news).toEqual([]);
  });
});
