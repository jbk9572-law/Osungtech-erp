"use client";

import { useActionState, useState } from "react";
import { savePurchaseQuotePrices } from "@/app/(dashboard)/purchase-quote-requests/actions";
import { NumberInput } from "@/components/number-input";
import { FormMessage } from "@/components/form-message";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { formatNumber } from "@/lib/format-number";

type Item = { id: string; label: string; spec: string | null; quantity: number };

// table-layout: auto(기본값)로는 모바일 폭에서 <th style={{width}}>가 그냥
// "희망 폭"이라 견적단가 입력칸이 찌그러진다 — new-quote-form.tsx와 같은
// 기법으로 표를 모든 칸 폭의 합만큼 고정폭으로 못박아 erp-grid-wrap의
// overflow:auto가 가로 스크롤을 대신하게 한다.
const PRICE_GRID_TOTAL_WIDTH = 240 + 120 + 90 + 120 + 120;

export function PurchaseQuotePriceForm({
  purchaseQuoteRequestId,
  supplierId,
  items,
  initialPrices,
}: {
  purchaseQuoteRequestId: string;
  supplierId: string;
  items: Item[];
  // 이미 저장된 단가가 있으면 그 값으로, 없으면 0으로 시작한다.
  initialPrices: Record<string, number>;
}) {
  const [state, formAction, pending] = useActionState(savePurchaseQuotePrices, undefined);
  const [prices, setPrices] = useState<Record<string, number>>(initialPrices);

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="purchase_quote_request_id" value={purchaseQuoteRequestId} />
      <input type="hidden" name="supplier_id" value={supplierId} />

      <div className="erp-grid-wrap">
        <table
          className="erp-grid"
          style={{ tableLayout: "fixed", width: PRICE_GRID_TOTAL_WIDTH, minWidth: PRICE_GRID_TOTAL_WIDTH }}
        >
          <thead>
            <tr>
              <th style={{ width: 240 }}>품목</th>
              <th style={{ width: 120 }}>규격</th>
              <th className="num" style={{ width: 90 }}>수량</th>
              <th className="num" style={{ width: 120 }}>견적단가</th>
              <th className="num" style={{ width: 120 }}>견적금액</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const price = prices[item.id] ?? 0;
              return (
                <tr key={item.id}>
                  <td>
                    {item.label}
                    <input type="hidden" name="item_id" value={item.id} />
                  </td>
                  <td>{item.spec ?? "-"}</td>
                  <td className="num">{formatNumber(item.quantity)}</td>
                  <td>
                    <NumberInput
                      value={price}
                      onChange={(n) => setPrices((prev) => ({ ...prev, [item.id]: n }))}
                      className="erp-input"
                    />
                    <input type="hidden" name="unit_price" value={price} />
                  </td>
                  <td className="num">{formatNumber((price * item.quantity))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" className="erp-btn erp-btn-primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "저장 중..." : "견적가 저장"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
