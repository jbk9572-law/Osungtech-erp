"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNumber } from "@/lib/format-number";
import { OrderDetailPanel, type OrderDetailItem, type OrderDetailSelection } from "@/components/grid/order-detail-panel";

export type PortalOrderRow = {
  id: string;
  docNo: number;
  createdAt: string;
  itemCount: number;
  totalAmount: number;
  progressLabel: string;
  isRejected: boolean;
  memo: string | null;
  items: OrderDetailItem[];
};

// 매출관리(SalesGridTable + OrderDetailPanel)와 같은 마스터-디테일
// 구성 — 목록에서 행을 클릭하면 아래 품목내역 패널에 바로 펼쳐 보여준다
// (거래처가 주문마다 상세 화면으로 매번 넘어가지 않아도 됨). 상세
// 화면에서만 가능한 진행상태 트래커/공정 체크리스트는 여전히 "상세보기"
// 링크로 들어가야 볼 수 있다 — 이 패널은 품목내역 미리보기 전용이다.
export function PortalOrdersGridTable({ rows, ordersHref }: { rows: PortalOrderRow[]; ordersHref: string }) {
  const [manualActiveKey, setManualActiveKey] = useState<string | null>(null);
  const activeKey = manualActiveKey && rows.some((r) => r.id === manualActiveKey) ? manualActiveKey : (rows[0]?.id ?? null);
  const active = rows.find((r) => r.id === activeKey) ?? null;
  const selection: OrderDetailSelection | null = active
    ? {
        label: `주문 ${active.docNo}`,
        dateLabel: new Date(active.createdAt).toLocaleDateString("ko-KR"),
        items: active.items,
      }
    : null;

  return (
    <>
      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 90 }}>주문번호</th>
              <th style={{ width: 110 }}>주문일</th>
              <th style={{ width: 70 }}>품목수</th>
              <th className="num" style={{ width: 120 }}>합계</th>
              <th style={{ width: 160 }}>진행상태</th>
              <th>요청사항</th>
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
                <td>{new Date(row.createdAt).toLocaleDateString("ko-KR")}</td>
                <td className="num">{row.itemCount}</td>
                <td className="num">{formatNumber(row.totalAmount)}</td>
                <td>
                  <span className={`erp-badge ${row.isRejected ? "erp-badge-danger" : "erp-badge-info"}`}>
                    {row.progressLabel}
                  </span>
                </td>
                <td style={{ color: "var(--erp-text-muted)" }}>{row.memo ?? "-"}</td>
                <td className="num" onClick={(e) => e.stopPropagation()}>
                  <Link href={`${ordersHref}/${row.id}`} className="erp-btn" style={{ height: 24, padding: "1px 10px", fontSize: 11 }}>
                    상세보기
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="erp-grid-empty">
                  조회 기간에 주문 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <OrderDetailPanel
        selection={selection}
        priceLabel="단가"
        emptyMessage="위 목록에서 주문을 선택하면 품목내역이 여기에 표시됩니다."
      />
    </>
  );
}
