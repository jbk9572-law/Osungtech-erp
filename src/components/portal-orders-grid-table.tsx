"use client";

import { formatKstDate, toKstDateStr } from "@/lib/kst-date";
import { GridBadge } from "@/components/grid/badge";
import { rowDay, rowDayClass } from "@/lib/row-day";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatNumber } from "@/lib/format-number";
import type { OrderDetailItem } from "@/components/grid/order-detail-panel";
import { startRouteProgress } from "@/lib/route-progress";
import { GridRowLegend } from "@/components/grid/row-legend";

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

// 포털 주문 목록 — 행을 누르면 주문 상세 화면으로 이동한다(행 아래 아코디언 펼침 없음 — 개발헌법 12번).
// 진행상태 트래커·공정 체크리스트·품목내역은 모두 상세 화면에서 본다.
export function PortalOrdersGridTable({ rows, ordersHref }: { rows: PortalOrderRow[]; ordersHref: string }) {
  const router = useRouter();
  const open = (id: string) => {
    startRouteProgress();
    router.push(`${ordersHref}/${id}`);
  };

  return (
    <>
      <GridRowLegend />
      <div className="erp-grid-wrap has-card-view">
        <table className="erp-grid">
          <thead>
            <tr>
              <th className="erp-col-m">주문번호</th>
              <th className="erp-col-l">주문일</th>
              <th className="erp-col-s">품목수</th>
              <th className="num erp-col-l">합계</th>
              <th className="erp-col-xxl">진행상태</th>
              <th>요청사항</th>
              <th className="erp-col-m"  />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              return (
                  <tr key={row.id} className={`cursor-pointer${rowDayClass(rowDay(toKstDateStr(new Date(row.createdAt))))}`} onClick={() => open(row.id)}>
                    <td className="erp-u-semibold">{row.docNo}</td>
                    <td>
                      {formatKstDate(row.createdAt)}
                    </td>
                    <td className="num">{row.itemCount}</td>
                    <td className="num">{formatNumber(row.totalAmount)}</td>
                    <td>
                      <GridBadge tone={row.isRejected ? "danger" : "info"}>
                        {row.progressLabel}
                      </GridBadge>
                    </td>
                    <td className="erp-u-muted">{row.memo ?? "-"}</td>
                    <td className="num" onClick={(e) => e.stopPropagation()}>
                      <Link href={`${ordersHref}/${row.id}`} className="erp-btn erp-portal-action-btn">
                        상세보기
                      </Link>
                    </td>
                  </tr>
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
            <div
              key={row.id}
              className={`erp-row-card${rowDayClass(rowDay(toKstDateStr(new Date(row.createdAt))))}`}
              role="button"
              tabIndex={0}
              onClick={() => open(row.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") open(row.id);
              }}
            >
              <div className="erp-row-card-head">
                <span className="erp-row-card-partner">주문 {row.docNo}</span>
                <span className="erp-row-card-date">
                  {formatKstDate(row.createdAt)}
                </span>
              </div>
              <div className="erp-row-card-item">
                품목 {row.itemCount}건{row.memo ? ` · ${row.memo}` : ""}
              </div>
              <div className="erp-row-card-foot">
                <GridBadge tone={row.isRejected ? "danger" : "info"}>
                  {row.progressLabel}
                </GridBadge>
                <span className="erp-row-card-amount">{formatNumber(row.totalAmount)}원</span>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Link href={`${ordersHref}/${row.id}`} className="erp-btn erp-portal-action-btn" style={{ width: "100%", marginTop: 4 }}>
                  상세보기
                </Link>
              </div>
            </div>
        ))}
        {rows.length === 0 && <p className="erp-grid-empty">조회 기간에 주문 내역이 없습니다.</p>}
      </div>
    </>
  );
}
