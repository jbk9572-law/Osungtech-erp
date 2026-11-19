import Link from "next/link";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { formatNumber } from "@/lib/format-number";
import type { OrderDetailSelection } from "@/components/grid/order-detail-panel";

// 목록 오른쪽에 고정되는 상세 패널 — 같은 선택(OrderDetailSelection)을 아코디언(OrderDetailPanel)과 공유한다.
// 어느 쪽이 보일지는 테마 토큰이 정한다(--erp-detail-side-display / --erp-detail-inline-display),
// 좁은 화면(≤1100px)에서는 항상 기존 아코디언이 보인다. 매출/매입 목록이 같이 쓴다.
export function OrderSidePanel({
  selection,
  priceLabel,
}: {
  selection: OrderDetailSelection | null;
  priceLabel: string;
}) {
  const items = selection?.items ?? [];
  const supply = items.reduce((s, i) => s + i.supplyAmount, 0);
  const tax = items.reduce((s, i) => s + i.taxAmount, 0);
  const sign = selection?.isReturn ? "-" : "";

  return (
    <aside className="erp-detail-side" aria-label="선택한 전표 상세">
      {!selection ? (
        <p className="erp-detail-side-empty">행을 선택하면 상세가 여기에 보입니다.</p>
      ) : (
        <>
          <div className="erp-detail-side-head">
            <b>{selection.label}</b>
            <span>{selection.dateLabel}</span>
          </div>
          {selection.meta && selection.meta.length > 0 && (
            <dl className="erp-detail-side-kv">
              {selection.meta.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="erp-detail-side-items">
            {items.length === 0 ? (
              <p className="erp-detail-side-empty">품목내역이 없습니다.</p>
            ) : (
              items.map((item, i) => (
                <div key={i} className="erp-detail-side-item">
                  <div className="erp-detail-side-item-name">
                    {item.productLabel}
                    {item.spec ? <span> {item.spec}</span> : null}
                  </div>
                  <div className="erp-detail-side-item-num">
                    {formatNumber(item.quantity)} {item.unit ?? ""} × {priceLabel} {formatNumOrDash(item.unitPrice)}
                    <b>{sign}{formatNumber(item.supplyAmount)}</b>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="erp-detail-side-total">
            <div><span>공급가액</span><span>{sign}{formatNumber(supply)}</span></div>
            <div><span>세액</span><span>{sign}{formatNumber(tax)}</span></div>
            <div className="erp-detail-side-total-sum"><span>합계</span><span>{sign}{formatNumber(supply + tax)}</span></div>
          </div>
          {(selection.detailHref || selection.printHref) && (
            <div className="erp-detail-side-actions">
              {selection.detailHref && <Link href={selection.detailHref} className="erp-btn">상세 보기</Link>}
              {selection.printHref && <Link href={selection.printHref} className="erp-btn">명세표 인쇄</Link>}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
