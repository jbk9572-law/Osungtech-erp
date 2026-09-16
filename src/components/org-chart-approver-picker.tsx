"use client";

import { useState } from "react";
import type { OrgDepartmentNode } from "@/lib/org-chart";
import { PageGuide } from "@/components/erp/page-guide";

export type PickedPerson = { id: string; name: string };

// 전자결재 기안서의 결재선/참조자 선택기 — 조직도(부서 트리)를 펼쳐보며
// 사람을 클릭해서 담는다. "결재자"/"참조자" 중 지금 어느 쪽에 담을지
// 탭으로 고르고, 결재자는 클릭한 순서 그대로 결재 순서가 된다.
export function OrgChartApproverPicker({
  tree,
  approvers,
  references,
  onChangeApprovers,
  onChangeReferences,
}: {
  tree: OrgDepartmentNode[];
  approvers: PickedPerson[];
  references: PickedPerson[];
  onChangeApprovers: (next: PickedPerson[]) => void;
  onChangeReferences: (next: PickedPerson[]) => void;
}) {
  const [target, setTarget] = useState<"approver" | "reference">("approver");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function togglePerson(person: PickedPerson) {
    if (target === "approver") {
      const exists = approvers.some((a) => a.id === person.id);
      onChangeApprovers(exists ? approvers.filter((a) => a.id !== person.id) : [...approvers, person]);
    } else {
      const exists = references.some((a) => a.id === person.id);
      onChangeReferences(exists ? references.filter((a) => a.id !== person.id) : [...references, person]);
    }
  }

  function isSelected(id: string) {
    return target === "approver" ? approvers.some((a) => a.id === id) : references.some((a) => a.id === id);
  }

  function renderNode(node: OrgDepartmentNode, depth: number) {
    const isOpen = expanded[node.id] ?? true;
    return (
      <div key={node.id} style={{ marginLeft: depth * 16 }}>
        <button
          type="button"
          onClick={() => setExpanded((prev) => ({ ...prev, [node.id]: !isOpen }))}
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ padding: "3px 0", background: "none", border: "none", cursor: "pointer", color: "var(--erp-text)" }}
        >
          {isOpen ? "▾" : "▸"} {node.name}
        </button>
        {isOpen && (
          <div style={{ marginLeft: 16 }}>
            {node.employees.map((e) => {
              const selected = isSelected(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => togglePerson({ id: e.id, name: e.fullName })}
                  className="flex w-full items-center justify-between text-xs"
                  style={{
                    padding: "4px 8px",
                    border: "1px solid transparent",
                    background: selected ? "var(--erp-selected)" : "transparent",
                    borderColor: selected ? "var(--erp-primary)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>
                    {e.fullName}
                    {e.positionTitle ? ` (${e.positionTitle})` : ""}
                  </span>
                  {selected && <span style={{ color: "var(--erp-primary)" }}>✓</span>}
                </button>
              );
            })}
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <div className="flex gap-1" style={{ marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => setTarget("approver")}
            className={`erp-btn${target === "approver" ? " erp-btn-primary" : ""}`}
            style={{ minWidth: 0, height: 26, padding: "0 10px", fontSize: 11.5 }}
          >
            결재자에 추가
          </button>
          <button
            type="button"
            onClick={() => setTarget("reference")}
            className={`erp-btn${target === "reference" ? " erp-btn-primary" : ""}`}
            style={{ minWidth: 0, height: 26, padding: "0 10px", fontSize: 11.5 }}
          >
            참조자에 추가
          </button>
        </div>
        <div className="erp-grid-wrap" style={{ maxHeight: 280, overflowY: "auto", padding: 8 }}>
          {tree.length === 0 ? (
            <PageGuide>등록된 조직도가 없습니다. 환경설정 &gt; 조직도 관리에서 부서를 먼저 만들어주세요.</PageGuide>
          ) : (
            tree.map((node) => renderNode(node, 0))
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold">결재자 · 순서대로 결재({approvers.length}명)</p>
          {approvers.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
              아직 선택한 대상이 없습니다.
            </p>
          ) : (
            <ol className="flex flex-col gap-1">
              {approvers.map((a, idx) => (
                <li key={a.id} className="flex items-center justify-between text-xs" style={{ padding: "3px 8px", border: "1px solid var(--erp-border)" }}>
                  <span>
                    {idx + 1}. {a.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChangeApprovers(approvers.filter((x) => x.id !== a.id))}
                    className="erp-btn erp-btn-danger"
                    style={{ minWidth: 0, height: 20, padding: "0 6px", fontSize: 10.5 }}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold">참조자 · 열람만({references.length}명)</p>
          {references.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
              아직 선택한 대상이 없습니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {references.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-xs" style={{ padding: "3px 8px", border: "1px solid var(--erp-border)" }}>
                  <span>{r.name}</span>
                  <button
                    type="button"
                    onClick={() => onChangeReferences(references.filter((x) => x.id !== r.id))}
                    className="erp-btn erp-btn-danger"
                    style={{ minWidth: 0, height: 20, padding: "0 6px", fontSize: 10.5 }}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
