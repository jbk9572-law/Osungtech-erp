import { describe, expect, it } from "vitest";
import { buildOrgTree, UNASSIGNED_DEPARTMENT_ID } from "./org-chart";

describe("buildOrgTree", () => {
  it("부서를 부모-자식 트리로 조립한다", () => {
    const tree = buildOrgTree(
      [
        { id: "a", name: "본부", parentDepartmentId: null, sortOrder: 0 },
        { id: "b", name: "영업팀", parentDepartmentId: "a", sortOrder: 0 },
      ],
      [],
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("a");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe("b");
  });

  it("직원을 소속 부서에 배치한다", () => {
    const tree = buildOrgTree(
      [{ id: "a", name: "영업팀", parentDepartmentId: null, sortOrder: 0 }],
      [{ id: "u1", fullName: "홍길동", positionTitle: "팀장", departmentId: "a" }],
    );
    expect(tree[0].employees).toEqual([{ id: "u1", fullName: "홍길동", positionTitle: "팀장" }]);
  });

  it("부서 미배정 직원은 미배정 노드로 모은다", () => {
    const tree = buildOrgTree(
      [],
      [{ id: "u1", fullName: "홍길동", positionTitle: null, departmentId: null }],
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(UNASSIGNED_DEPARTMENT_ID);
    expect(tree[0].employees).toHaveLength(1);
  });

  it("부모 부서가 실제로 없으면(끊긴 참조) 루트로 취급한다", () => {
    const tree = buildOrgTree(
      [{ id: "b", name: "영업팀", parentDepartmentId: "missing", sortOrder: 0 }],
      [],
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("b");
  });
});
