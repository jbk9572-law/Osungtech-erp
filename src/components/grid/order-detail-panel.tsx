import { Fragment } from "react";
import { GridBadge } from "@/components/grid/badge";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { formatNumber } from "@/lib/format-number";

// 매출/매입 목록 화면의 마스터-디테일 레이아웃에서 공용으로 쓰는 "선택된
// 명세표의 품목내역" 패널 — 매출/매입 품목 shape이 단가 필드 이름만
// 다를(unitPrice/unitCost) 뿐 동일해서 하나로 합쳤다. 여기를 고치면
// 매출/매입 양쪽 화면에 동시에 반영된다.
export type OrderDetailItem = {
  productLabel: string;
  spec: string;
  lotNumber: string | null;
  remark: string | null;
  quantity: number;
  unit: string | null | undefined;
  unitPrice: number | null;
  supplyAmount: number;
  taxAmount: number;
  paperCalcSizeLines?: string[];
};

export type OrderDetailSelection = {
  label: string;
  dateLabel: string;
  items: OrderDetailItem[];
  isReturn?: boolean;
};

export function OrderDetailPanel({
  selection,
  priceLabel,
  emptyMessage,
}: {
  selection: OrderDetailSelection | null;
  priceLabel: string;
  emptyMessage: string;
}) {
  const totalQuantity = selection?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const totalSupply = selection?.items.reduce((sum, item) => sum + item.supplyAmount, 0) ?? 0;
  const totalTax = selection?.items.reduce((sum, item) => sum + item.taxAmount, 0) ?? 0;
  const sign = selection?.isReturn ? "+" : "";
  const amountSign = selection?.isReturn ? "-" : "";

  return (
    <div className="erp-detail">
      <div className="erp-detail-tabs">
        <div className="erp-detail-tab active">
          품목내역{selection ? ` — ${selection.dateLabel} ${selection.label}` : ""}
        </div>
      </div>
      <div className="erp-detail-body" style={{ padding: 0 }}>
        <div className="erp-grid-wrap has-card-view">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>품목명</th>
                <th>규격</th>
                <th>관리번호</th>
                <th className="num">수량</th>
                <th className="num">{priceLabel}</th>
                <th className="num">공급가액</th>
                <th className="num">세액</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {!selection || selection.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="erp-grid-empty">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                selection.items.map((item, i) => (
                  <Fragment key={i}>
                    <tr>
                      <td>
                        {item.productLabel}
                        {!!item.paperCalcSizeLines?.length && (
                          <GridBadge tone="info" style={{ marginLeft: 6 }}>
                            계산 연결됨
                          </GridBadge>
                        )}
                      </td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{item.spec}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{item.lotNumber || "-"}</td>
                      <td
                        className="num"
                        style={selection.isReturn ? { color: "var(--erp-danger)" } : undefined}
                      >
                        {sign}
                        {formatNumber(item.quantity)} {item.unit ?? ""}
                      </td>
                      <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                        {formatNumOrDash(item.unitPrice)}
                      </td>
                      <td
                        className="num"
                        style={selection.isReturn ? { color: "var(--erp-danger)" } : undefined}
                      >
                        {amountSign}
                        {formatNumber(item.supplyAmount)}
                      </td>
                      <td
                        className="num"
                        style={{ color: selection.isReturn ? "var(--erp-danger)" : "var(--erp-text-muted)" }}
                      >
                        {amountSign}
                        {formatNumber(item.taxAmount)}
                      </td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{item.remark || "-"}</td>
                    </tr>
                    {item.paperCalcSizeLines?.map((line, lineIndex) => (
                      <tr key={`size-${lineIndex}`}>
                        <td
                          colSpan={8}
                          style={{
                            paddingLeft: 26,
                            color: "var(--erp-text-muted)",
                            fontSize: 11.5,
                          }}
                        >
                          ㄴ {line}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
            {selection && selection.items.length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--erp-bg)", fontWeight: 700 }}>
                  <td colSpan={3}>합계 ({selection.items.length}건)</td>
                  <td className="num">{formatNumber(totalQuantity)}</td>
                  <td />
                  <td className="num">{formatNumber(totalSupply)}</td>
                  <td className="num">{formatNumber(totalTax)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="erp-row-card-list" style={{ padding: selection && selection.items.length > 0 ? 10 : 0 }}>
          {!selection || selection.items.length === 0 ? (
            <p className="erp-grid-empty">{emptyMessage}</p>
          ) : (
            <>
              {selection.items.map((item, i) => (
                <div className="erp-row-card" key={i}>
                  <div className="erp-row-card-head">
                    <span className="erp-row-card-partner">
                      {item.productLabel}
                      {!!item.paperCalcSizeLines?.length && (
                        <GridBadge tone="info" style={{ marginLeft: 6 }}>
                          계산 연결됨
                        </GridBadge>
                      )}
                    </span>
                  </div>
                  <dl className="erp-order-item-fields">
                    <div>
                      <dt>규격</dt>
                      <dd>{item.spec || "-"}</dd>
                    </div>
                    <div>
                      <dt>관리번호</dt>
                      <dd>{item.lotNumber || "-"}</dd>
                    </div>
                    <div>
                      <dt>수량</dt>
                      <dd style={selection.isReturn ? { color: "var(--erp-danger)" } : undefined}>
                        {sign}
                        {formatNumber(item.quantity)} {item.unit ?? ""}
                      </dd>
                    </div>
                    <div>
                      <dt>{priceLabel}</dt>
                      <dd>{formatNumOrDash(item.unitPrice)}</dd>
                    </div>
                    <div>
                      <dt>공급가액</dt>
                      <dd
                        style={{
                          fontWeight: 700,
                          color: selection.isReturn ? "var(--erp-danger)" : undefined,
                        }}
                      >
                        {amountSign}
                        {formatNumber(item.supplyAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt>세액</dt>
                      <dd style={{ color: selection.isReturn ? "var(--erp-danger)" : undefined }}>
                        {amountSign}
                        {formatNumber(item.taxAmount)}
                      </dd>
                    </div>
                    {item.remark && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <dt>비고</dt>
                        <dd>{item.remark}</dd>
                      </div>
                    )}
                  </dl>
                  {!!item.paperCalcSizeLines?.length && (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: "var(--erp-font-xs)",
                        color: "var(--erp-text-muted)",
                      }}
                    >
                      {item.paperCalcSizeLines.map((line, lineIndex) => (
                        <div key={lineIndex}>ㄴ {line}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="erp-row-card-foot" style={{ fontWeight: 700 }}>
                <span>합계 ({selection.items.length}건) · {formatNumber(totalQuantity)}개</span>
                <span className="erp-row-card-amount">
                  {formatNumber(totalSupply)}원
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
