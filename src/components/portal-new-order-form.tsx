"use client";

import { useActionState, useMemo, useState } from "react";
import { portalCreateOrder } from "@/app/portal/(app)/new/actions";
import { formatNumber } from "@/lib/format-number";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { PageGuide } from "@/components/erp/page-guide";

type CatalogRow = {
  product_id: string;
  sku: string;
  name: string;
  spec: string | null;
  unit: string;
  unit_price: number;
};

// table-layout: auto(기본값)로는 모바일 폭에서 <th style={{width}}>가 그냥
// "희망 폭"이라 품목 칸이 찌그러진다 — 거래처가 외부에서 모바일로 접속할
// 가능성이 높은 화면이라 특히 중요하다. new-quote-form.tsx와 같은 기법으로
// 표를 모든 칸 폭의 합만큼 고정폭으로 못박아 erp-grid-wrap의 overflow:auto가
// 가로 스크롤을 대신하게 한다.
const ORDER_GRID_TOTAL_WIDTH = 240 + 90 + 100 + 110 + 120;

export function PortalNewOrderForm({ catalog }: { catalog: CatalogRow[] }) {
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, string>>({});
  const [memo, setMemo] = useState("");
  const [state, formAction, pending] = useActionState(portalCreateOrder, undefined);

  const items = useMemo(
    () =>
      catalog
        .map((c) => ({ ...c, quantity: Number(qtyByProduct[c.product_id] ?? 0) }))
        .filter((c) => c.quantity > 0),
    [catalog, qtyByProduct],
  );
  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  if (catalog.length === 0) {
    return <PageGuide>아직 주문 가능한 품목이 없습니다. 담당 직원에게 문의해주세요.</PageGuide>;
  }

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="flex flex-col gap-3">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })))}
      />
      <div className="erp-grid-wrap">
        <table
          className="erp-grid"
          style={{ tableLayout: "fixed", width: ORDER_GRID_TOTAL_WIDTH, minWidth: ORDER_GRID_TOTAL_WIDTH }}
        >
          <thead>
            <tr>
              <th style={{ width: 240 }}>품목</th>
              <th style={{ width: 90 }}>규격</th>
              <th className="num" style={{ width: 100 }}>단가</th>
              <th className="num" style={{ width: 110 }}>수량</th>
              <th className="num" style={{ width: 120 }}>금액</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((c) => {
              const qty = Number(qtyByProduct[c.product_id] ?? 0);
              return (
                <tr key={c.product_id}>
                  <td>
                    {c.sku} · {c.name}
                  </td>
                  <td>{c.spec ?? "-"}</td>
                  <td className="num">{formatNumber(c.unit_price)}</td>
                  <td className="num">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="erp-input"
                      style={{ width: 90, textAlign: "right" }}
                      value={qtyByProduct[c.product_id] ?? ""}
                      onChange={(e) =>
                        setQtyByProduct((prev) => ({ ...prev, [c.product_id]: e.target.value }))
                      }
                    />{" "}
                    {c.unit}
                  </td>
                  <td className="num">{qty > 0 ? formatNumber(qty * c.unit_price) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="erp-field">
        <label htmlFor="portal-order-memo">요청사항(선택)</label>
        <textarea
          id="portal-order-memo"
          name="memo"
          rows={2}
          className="erp-input"
          style={{ width: "100%", height: "auto" }}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          합계: {formatNumber(total)}원 ({items.length}개 품목)
        </span>
        <button type="submit" className="erp-btn erp-btn-primary" disabled={pending || items.length === 0}>
          {pending ? "등록 중..." : "발주 등록"}
        </button>
      </div>

      {state?.error && (
        <p className="rounded-sm bg-[var(--erp-danger-bg)] px-3 py-2 text-xs font-medium text-[var(--erp-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
