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

  // 한 사람은 결재자 또는 참조자 한 쪽에만 담긴다 — 다른 쪽에 있으면 옮긴다(같은 사람이 양쪽에 들어가는 구멍 방지)
  function togglePerson(person: PickedPerson) {
    if (target === "approver") {
      const exists = approvers.some((a) => a.id === person.id);
      onChangeApprovers(exists ? approvers.filter((a) => a.id !== person.id) : [...approvers, person]);
      if (!exists) onChangeReferences(references.filter((r) => r.id !== person.id));
    } else {
      const exists = references.some((a) => a.id === person.id);
      onChangeReferences(exists ? references.filter((a) => a.id !== person.id) : [...references, person]);
      if (!exists) onChangeApprovers(approvers.filter((a) => a.id !== person.id));
    }
  }

  function isSelected(id: string) {
    return approvers.some((a) => a.id === id) || references.some((a) => a.id === id);
  }

  function renderNode(node: OrgDepartmentNode, depth: number) {
    const isOpen = expanded[node.id] ?? true;
    return (
      <div key={node.id} className={depth > 0 ? "erp-org-picker-sub" : undefined}>
        <button type="button" onClick={() => setExpanded((prev) => ({ ...prev, [node.id]: !isOpen }))} className="erp-org-picker-dept">
          {isOpen ? "▾" : "▸"} {node.name}
        </button>
        {isOpen && (
          <div className="erp-org-picker-sub">
            {node.employees.map((e) => {
              const selected = isSelected(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => togglePerson({ id: e.id, name: e.fullName })}
                  className={`erp-org-picker-person${selected ? " is-selected" : ""}`}
                  aria-pressed={selected}
                >
                  <span>
                    {e.fullName}
                    {e.positionTitle ? ` (${e.positionTitle})` : ""}
                  </span>
                  {selected && <span aria-hidden>✓</span>}
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
    <div className="erp-org-picker">
      <div className="erp-org-picker-pane">
        <div className="erp-org-picker-pane-head">
          <strong>조직도</strong>
          <span className="erp-seg" role="group" aria-label="담을 곳">
            <button type="button" className={target === "approver" ? "active" : ""} aria-pressed={target === "approver"} onClick={() => setTarget("approver")}>
              결재자
            </button>
            <button type="button" className={target === "reference" ? "active" : ""} aria-pressed={target === "reference"} onClick={() => setTarget("reference")}>
              참조자
            </button>
          </span>
        </div>
        <div className="erp-org-picker-body">
          {tree.length === 0 ? (
            <PageGuide>등록된 조직도가 없습니다. 환경설정 &gt; 조직도 관리에서 부서를 먼저 만들어주세요.</PageGuide>
          ) : (
            tree.map((node) => renderNode(node, 0))
          )}
        </div>
      </div>

      <div className="erp-org-picker-pane">
        <div className="erp-org-picker-pane-head">
          <strong>선택 결과</strong>
          <span className="erp-u-muted">결재 {approvers.length}명 · 참조 {references.length}명</span>
        </div>
        <div className="erp-org-picker-body">
          <p className="erp-org-picker-label">결재자 · 순서대로 결재</p>
          {approvers.length === 0 ? (
            <p className="erp-u-muted erp-u-text-sm">결재자를 1명 이상 선택하세요.</p>
          ) : (
            <ol className="erp-org-picker-list">
              {approvers.map((a, idx) => (
                <li key={a.id} className="erp-org-picker-chip">
                  <span>
                    {idx + 1}. {a.name}
                  </span>
                  <button type="button" onClick={() => onChangeApprovers(approvers.filter((x) => x.id !== a.id))} className="erp-btn erp-btn-xs erp-btn-danger">
                    삭제
                  </button>
                </li>
              ))}
            </ol>
          )}
          <p className="erp-org-picker-label">참조자 · 열람만</p>
          {references.length === 0 ? (
            <p className="erp-u-muted erp-u-text-sm">선택한 참조자가 없습니다. (선택 사항)</p>
          ) : (
            <ul className="erp-org-picker-list">
              {references.map((r) => (
                <li key={r.id} className="erp-org-picker-chip">
                  <span>{r.name}</span>
                  <button type="button" onClick={() => onChangeReferences(references.filter((x) => x.id !== r.id))} className="erp-btn erp-btn-xs erp-btn-danger">
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
