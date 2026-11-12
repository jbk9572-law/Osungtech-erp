"use client";

import { toKstDateStr } from "@/lib/kst-date";
import { rowDay, rowDayClass } from "@/lib/row-day";
import { Fragment, useState } from "react";
import Link from "next/link";
import { formatNumber } from "@/lib/format-number";
import { OrderDetailPanel, type OrderDetailItem, type OrderDetailSelection } from "@/components/grid/order-detail-panel";
import { useEscapeToClose } from "@/lib/use-escape-to-close";

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
  // 행을 클릭하면 그 행 바로 아래에 품목내역을 아코디언으로 펼친다
  // (매출관리와 같은 패턴 — sales-grid-table.tsx 참고). 아무것도 안
  // 고른 기본값(null)에서 시작한다.
  const [manualActiveKey, setManualActiveKey] = useState<string | null>(null);
  const activeKey = manualActiveKey && rows.some((r) => r.id === manualActiveKey) ? manualActiveKey : null;
  const active = rows.find((r) => r.id === activeKey) ?? null;
  const selection: OrderDetailSelection | null = active
    ? {
        label: `주문 ${active.docNo}`,
        dateLabel: new Date(active.createdAt).toLocaleDateString("ko-KR"),
        items: active.items,
      }
    : null;
  function toggleAccordion(id: string) {
    setManualActiveKey((prev) => (prev === id ? null : id));
  }
  useEscapeToClose(activeKey !== null, () => setManualActiveKey(null));

  return (
    <>
      <div className="erp-grid-wrap has-card-view">
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
            {rows.map((row) => {
              const rowSelection: OrderDetailSelection = {
                label: `주문 ${row.docNo}`,
                dateLabel: new Date(row.createdAt).toLocaleDateString("ko-KR"),
                items: row.items,
              };
              return (
                <Fragment key={row.id}>
                  <tr
                    className={`cursor-pointer${row.id === activeKey ? " master-active" : ""}${rowDayClass(rowDay(toKstDateStr(new Date(row.createdAt))))}`}
                    onClick={() => toggleAccordion(row.id)}
                  >
                    <td style={{ fontWeight: 600 }}>{row.docNo}</td>
                    <td>
                      {new Date(row.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="num">{row.itemCount}</td>
                    <td className="num">{formatNumber(row.totalAmount)}</td>
                    <td>
                      <span className={`erp-badge ${row.isRejected ? "erp-badge-danger" : "erp-badge-info"}`}>
                        {row.progressLabel}
                      </span>
                    </td>
                    <td style={{ color: "var(--erp-text-muted)" }}>{row.memo ?? "-"}</td>
                    <td className="num" onClick={(e) => e.stopPropagation()}>
                      <Link href={`${ordersHref}/${row.id}`} className="erp-btn erp-portal-action-btn">
                        상세보기
                      </Link>
                    </td>
                  </tr>
                  {row.id === activeKey && (
                    <tr className="erp-grid-accordion-row">
                      <td colSpan={7}>
                        <OrderDetailPanel selection={rowSelection} priceLabel="단가" emptyMessage="품목내역이 없습니다." />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
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

      <div className="erp-row-card-list">
        {rows.map((row) => (
          <Fragment key={row.id}>
            <div
              className={`erp-row-card${row.id === activeKey ? " selected" : ""}${rowDayClass(rowDay(toKstDateStr(new Date(row.createdAt))))}`}
              role="button"
              tabIndex={0}
              onClick={() => toggleAccordion(row.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") toggleAccordion(row.id);
              }}
            >
              <div className="erp-row-card-head">
                <span className="erp-row-card-partner">주문 {row.docNo}</span>
                <span className="erp-row-card-date">
                  {new Date(row.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <div className="erp-row-card-item">
                품목 {row.itemCount}건{row.memo ? ` · ${row.memo}` : ""}
              </div>
              <div className="erp-row-card-foot">
                <span className={`erp-badge ${row.isRejected ? "erp-badge-danger" : "erp-badge-info"}`}>
                  {row.progressLabel}
                </span>
                <span className="erp-row-card-amount">{formatNumber(row.totalAmount)}원</span>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Link href={`${ordersHref}/${row.id}`} className="erp-btn erp-portal-action-btn" style={{ width: "100%", marginTop: 4 }}>
                  상세보기
                </Link>
              </div>
            </div>
            {row.id === activeKey && (
              <OrderDetailPanel selection={selection} priceLabel="단가" emptyMessage="품목내역이 없습니다." />
            )}
          </Fragment>
        ))}
        {rows.length === 0 && <p className="erp-grid-empty">조회 기간에 주문 내역이 없습니다.</p>}
      </div>
    </>
  );
}
