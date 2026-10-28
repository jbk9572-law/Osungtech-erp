import Link from "next/link";
import { formatPackageQty } from "@/lib/package-qty";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { formatNumber } from "@/lib/format-number";

// 매출/매입 상세(sales/[id], purchases/[id])의 품목내역 표 — 두 화면이
// 단가 필드 이름(unit_price/unit_cost)만 다를 뿐 완전히 동일한 11칸
// 표(SKU/품목명/규격/관리번호/단위/포장수량/수량/단가/공급가액/세액/
// 비고)를 각자 복붙해서 갖고 있던 걸 하나로 합쳤다 — 여기를 고치면
// 매출/매입 상세 양쪽에 동시에 반영된다.
//
// 상세 화면이라 "나머진 카드 눌러서 상세에서 봐라"로 미룰 다음 화면이
// 없다 — 그래서 매출/매입 "목록" 카드(erp-row-card-item 등)처럼 일부
// 필드만 추리지 않고, 데스크톱 표에 있는 필드를 전부 모바일 카드에도
// 보여준다(사용자 지적 — "나머지 품목이나 규격 수량 기타등등 다
// 표기되어야하는거 아니야?").
export type OrderItemRow = {
  id: string;
  sku: string | null | undefined;
  productLabel: string;
  spec: string | null;
  lotNumber: string | null;
  unit: string | null | undefined;
  basePackageQty: number | null | undefined;
  quantity: number;
  unitPrice: number | null;
  supplyAmount: number;
  taxAmount: number;
  remark: string | null;
  // 이 줄이 모조지(PAPER_STOCK_SKU) 품목이고 연결된 모조지 계산이 있으면,
  // 이 줄 바로 아래에 paperCalcSizeLines를 규격별 보조 줄로 붙인다.
  showPaperCalcSizeLines?: boolean;
};

function LotBadge({ lotNumber }: { lotNumber: string | null }) {
  if (!lotNumber) return <>-</>;
  return (
    <Link
      href={`/inventory/lot-lookup?q=${encodeURIComponent(lotNumber)}`}
      className="erp-badge erp-badge-muted"
      style={{ textDecoration: "none" }}
    >
      {lotNumber}
    </Link>
  );
}

export function OrderItemsTable({
  rows,
  priceLabel,
  paperCalcSizeLines,
  totalSupply,
  totalTax,
}: {
  rows: OrderItemRow[];
  priceLabel: string;
  paperCalcSizeLines: string[];
  totalSupply: number;
  totalTax: number;
}) {
  return (
    <>
      <div className="erp-grid-wrap has-card-view">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>품목명</th>
              <th>규격</th>
              <th>관리번호</th>
              <th>단위</th>
              <th className="num">포장수량</th>
              <th className="num">수량</th>
              <th className="num">{priceLabel}</th>
              <th className="num">공급가액</th>
              <th className="num">세액</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((row) => {
              const mainRow = (
                <tr key={row.id}>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.sku}</td>
                  <td>{row.productLabel}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.spec || "-"}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    <LotBadge lotNumber={row.lotNumber} />
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.unit}</td>
                  <td
                    className="num"
                    style={{ color: row.basePackageQty ? "var(--erp-danger)" : "var(--erp-text-muted)" }}
                  >
                    {formatPackageQty(row.basePackageQty, row.quantity)}
                  </td>
                  <td className="num">{formatNumber(row.quantity)}</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {formatNumOrDash(row.unitPrice)}
                  </td>
                  <td className="num">{formatNumber(row.supplyAmount)}</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {formatNumber(row.taxAmount)}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.remark || "-"}</td>
                </tr>
              );

              if (!row.showPaperCalcSizeLines || paperCalcSizeLines.length === 0) {
                return [mainRow];
              }

              const sizeRows = paperCalcSizeLines.map((line, i) => (
                <tr key={`${row.id}-size-${i}`} style={{ background: "var(--erp-bg-subtle)" }}>
                  <td />
                  <td colSpan={3} style={{ color: "var(--erp-text-muted)", paddingLeft: 24 }}>
                    ㄴ {line}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                </tr>
              ));
              return [mainRow, ...sizeRows];
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--erp-bg)", fontWeight: 700 }}>
              <td colSpan={8} className="num">
                합계
              </td>
              <td className="num">{formatNumber(totalSupply)}</td>
              <td className="num">{formatNumber(totalTax)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="erp-row-card-list">
        {rows.flatMap((row) => {
          const card = (
            <div className="erp-row-card" key={row.id}>
              <div className="erp-row-card-head">
                <span className="erp-row-card-partner">{row.productLabel}</span>
                {row.sku && (
                  <span className="erp-row-card-date" style={{ fontWeight: 400 }}>
                    {row.sku}
                  </span>
                )}
              </div>
              <dl className="erp-order-item-fields">
                <div>
                  <dt>규격</dt>
                  <dd>{row.spec || "-"}</dd>
                </div>
                <div>
                  <dt>관리번호</dt>
                  <dd>
                    <LotBadge lotNumber={row.lotNumber} />
                  </dd>
                </div>
                <div>
                  <dt>단위</dt>
                  <dd>{row.unit || "-"}</dd>
                </div>
                <div>
                  <dt>포장수량</dt>
                  <dd style={{ color: row.basePackageQty ? "var(--erp-danger)" : undefined }}>
                    {formatPackageQty(row.basePackageQty, row.quantity)}
                  </dd>
                </div>
                <div>
                  <dt>수량</dt>
                  <dd>{formatNumber(row.quantity)}</dd>
                </div>
                <div>
                  <dt>{priceLabel}</dt>
                  <dd>{formatNumOrDash(row.unitPrice)}</dd>
                </div>
                <div>
                  <dt>공급가액</dt>
                  <dd style={{ fontWeight: 700 }}>{formatNumber(row.supplyAmount)}</dd>
                </div>
                <div>
                  <dt>세액</dt>
                  <dd>{formatNumber(row.taxAmount)}</dd>
                </div>
                {row.remark && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <dt>비고</dt>
                    <dd>{row.remark}</dd>
                  </div>
                )}
              </dl>
            </div>
          );

          if (!row.showPaperCalcSizeLines || paperCalcSizeLines.length === 0) {
            return [card];
          }

          return [
            card,
            <div
              key={`${row.id}-sizes`}
              style={{
                marginTop: -4,
                paddingLeft: 14,
                fontSize: "var(--erp-font-xs)",
                color: "var(--erp-text-muted)",
              }}
            >
              {paperCalcSizeLines.map((line, i) => (
                <div key={i}>ㄴ {line}</div>
              ))}
            </div>,
          ];
        })}
        {rows.length > 0 && (
          <div className="erp-row-card-foot" style={{ fontWeight: 700, padding: "4px 2px" }}>
            <span>합계</span>
            <span className="erp-row-card-amount">
              공급가액 {formatNumber(totalSupply)}원 · 세액 {formatNumber(totalTax)}원
            </span>
          </div>
        )}
      </div>
    </>
  );
}
