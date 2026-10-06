"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNumber } from "@/lib/format-number";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";

const WORK_ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  material_issued: "생산중",
  completed: "생산완료",
  cancelled: "취소",
};

const STEP_STATUS_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "입고 대기", tone: "muted" },
  received: { label: "입고완료", tone: "info" },
  in_progress: { label: "작업중", tone: "warn" },
  done: { label: "완료", tone: "ok" },
  shipped: { label: "출고완료", tone: "ok" },
  returned: { label: "반품됨", tone: "danger" },
};

export type PortalAssignmentStep = {
  processName: string;
  sortOrder: number;
  status: string;
  isMine: boolean;
};

export type PortalAssignmentRow = {
  id: string;
  docNo: number;
  productName: string;
  productSpec: string | null;
  quantity: number;
  status: string;
  orderDate: string;
  steps: PortalAssignmentStep[];
};

// 매출/매입 목록의 마스터-디테일(그리드+아래 상세패널) 구성을 그대로
// 가져왔다 — 다만 포털의 "배정된 공정"은 명세표가 아니라 생산지시(LOT)
// 하나가 한 행이라 품목내역 대신 그 LOT의 공정별 진행상황을 패널에
// 보여준다. 실제 상태 변경/불량신고 같은 조작은 여전히 "상세보기"로
// 들어가야 한다 — 이 패널은 미리보기 전용.
export function PortalAssignmentsGridTable({
  rows,
  assignmentsHref,
}: {
  rows: PortalAssignmentRow[];
  assignmentsHref: string;
}) {
  const [manualActiveKey, setManualActiveKey] = useState<string | null>(null);
  const activeKey = manualActiveKey && rows.some((r) => r.id === manualActiveKey) ? manualActiveKey : (rows[0]?.id ?? null);
  const active = rows.find((r) => r.id === activeKey) ?? null;

  return (
    <>
      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 90 }}>LOT</th>
              <th>품목</th>
              <th style={{ width: 100 }}>규격</th>
              <th className="num" style={{ width: 90 }}>수량</th>
              <th style={{ width: 110 }}>제조일</th>
              <th style={{ width: 100 }}>상태</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`cursor-pointer${row.id === activeKey ? " master-active" : ""}`}
                onClick={() => setManualActiveKey(row.id)}
              >
                <td style={{ fontWeight: 600 }}>{row.docNo}</td>
                <td>{row.productName}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{row.productSpec ?? "-"}</td>
                <td className="num">{formatNumber(row.quantity)}</td>
                <td>{row.orderDate.replaceAll("-", ".")}</td>
                <td>
                  <span className="erp-badge erp-badge-muted">{WORK_ORDER_STATUS_LABEL[row.status] ?? row.status}</span>
                </td>
                <td className="num" onClick={(e) => e.stopPropagation()}>
                  <Link href={`${assignmentsHref}/${row.id}`} className="erp-btn" style={{ height: 24, padding: "1px 10px", fontSize: 11 }}>
                    상세보기
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="erp-grid-empty">
                  조회 기간에 배정된 공정이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <div className="erp-detail-tab active">
            공정 진행상황{active ? ` — LOT ${active.docNo} ${active.productName}` : ""}
          </div>
        </div>
        <div className="erp-detail-body">
          {!active || active.steps.length === 0 ? (
            <p className="erp-grid-empty" style={{ fontSize: 12 }}>
              위 목록에서 LOT을 선택하면 공정별 진행상황이 여기에 표시됩니다.
            </p>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {active.steps.map((step) => (
                <span
                  key={`${active.id}-${step.processName}-${step.sortOrder}`}
                  className="erp-key-hint"
                  style={{ fontSize: 12, fontWeight: step.isMine ? 700 : 500 }}
                >
                  <GridBadge tone={(STEP_STATUS_LABEL[step.status] ?? STEP_STATUS_LABEL.pending).tone}>
                    {(STEP_STATUS_LABEL[step.status] ?? STEP_STATUS_LABEL.pending).label}
                  </GridBadge>
                  {step.processName}
                  {step.isMine && <span style={{ marginLeft: 4, color: "var(--erp-primary)" }}>(우리 업체)</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
