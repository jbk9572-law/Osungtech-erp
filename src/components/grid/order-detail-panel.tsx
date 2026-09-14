import { Fragment } from "react";
import { GridBadge } from "@/components/grid/badge";
import { formatNumOrDash } from "@/lib/format-num-or-dash";

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
      <div style={{ padding: 0 }}>
        <div className="erp-grid-wrap">
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
                        {item.quantity.toLocaleString()} {item.unit ?? ""}
                      </td>
                      <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                        {formatNumOrDash(item.unitPrice)}
                      </td>
                      <td
                        className="num"
                        style={selection.isReturn ? { color: "var(--erp-danger)" } : undefined}
                      >
                        {amountSign}
                        {item.supplyAmount.toLocaleString()}
                      </td>
                      <td
                        className="num"
                        style={{ color: selection.isReturn ? "var(--erp-danger)" : "var(--erp-text-muted)" }}
                      >
                        {amountSign}
                        {item.taxAmount.toLocaleString()}
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
                  <td className="num">{totalQuantity.toLocaleString()}</td>
                  <td />
                  <td className="num">{totalSupply.toLocaleString()}</td>
                  <td className="num">{totalTax.toLocaleString()}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
