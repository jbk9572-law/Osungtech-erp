import { quantityLabelByUnit } from "@/lib/quantity-by-unit";
import Link from "next/link";
import { GridBadge } from "@/components/grid/badge";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { formatNumber } from "@/lib/format-number";
import type { OrderDetailSelection } from "@/components/grid/order-detail-panel";

// 목록 오른쪽에 고정되는 상세 패널 — 같은 선택(OrderDetailSelection)을 아코디언(OrderDetailPanel)과 공유한다.
// 어느 쪽이 보일지는 테마 토큰이 정한다(--erp-detail-side-display / --erp-detail-inline-display),
// 좁은 화면(≤1100px)에서는 항상 기존 아코디언이 보인다. 매출/매입 목록이 같이 쓴다.
// 재고·미수금 패널(DetailSideShell)과 같은 .erp-detail-side* 모양(윗줄 강조색, 제목+색 칩, 구역 제목, 합계 상자)을 쓴다.
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
  const qtyLabel = quantityLabelByUnit(items);
  const sign = selection?.isReturn ? "-" : "";

  return (
    <aside className="erp-detail-side" aria-label="선택한 전표 상세" data-tone={selection?.accent ?? (selection?.isReturn ? "danger" : undefined)}>
      {!selection ? (
        <p className="erp-detail-side-empty">행을 선택하면 상세가 여기에 보입니다.</p>
      ) : (
        <>
          <div className="erp-detail-side-hero">
            {selection.chips && selection.chips.length > 0 && (
              <div className="erp-detail-side-chips">
                {selection.chips.map((c) => (
                  <GridBadge key={c.label} tone={c.tone}>
                    {c.label}
                  </GridBadge>
                ))}
              </div>
            )}
            <b className="erp-detail-side-title">{selection.label}</b>
            <span className="erp-detail-side-date">{selection.dateLabel}</span>
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
          <div className="erp-detail-side-sec">
            <h4>
              품목내역 <em>{items.length}건 · 수량 {qtyLabel}</em>
            </h4>
            {items.length === 0 ? (
              <p className="erp-detail-side-note">품목내역이 없습니다.</p>
            ) : (
              items.map((item, i) => (
                <div key={i} className="erp-detail-side-item">
                  <div className="erp-detail-side-item-name">
                    {item.productLabel}
                    {item.spec ? <span> {item.spec}</span> : null}
                    {item.lotNumber ? (
                      <GridBadge tone="muted" className="erp-detail-side-lot">
                        {item.lotNumber}
                      </GridBadge>
                    ) : null}
                  </div>
                  <div className="erp-detail-side-item-num">
                    <span>
                      {formatNumber(item.quantity)} {item.unit ?? ""} × {priceLabel} {formatNumOrDash(item.unitPrice)}
                    </span>
                    <b>{sign}{formatNumber(item.supplyAmount)}</b>
                  </div>
                  {item.remark ? <div className="erp-detail-side-item-note">비고 {item.remark}</div> : null}
                  {item.paperCalcSizeLines?.map((line) => (
                    <div key={line} className="erp-detail-side-item-note">
                      ㄴ {line}
                    </div>
                  ))}
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
              {selection.detailHref && <Link href={selection.detailHref} className="erp-btn erp-btn-primary">상세 보기</Link>}
              {selection.printHref && <Link href={selection.printHref} className="erp-btn">명세표 인쇄</Link>}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
