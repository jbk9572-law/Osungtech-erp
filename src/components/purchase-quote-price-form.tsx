"use client";

import { useActionState, useState } from "react";
import { savePurchaseQuotePrices } from "@/app/(dashboard)/purchase-quote-requests/actions";
import { NumberInput } from "@/components/number-input";
import { FormMessage } from "@/components/form-message";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";

type Item = { id: string; label: string; spec: string | null; quantity: number };

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
        <table className="erp-grid">
          <thead>
            <tr>
              <th>품목</th>
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
                  <td className="num">{item.quantity.toLocaleString()}</td>
                  <td>
                    <NumberInput
                      value={price}
                      onChange={(n) => setPrices((prev) => ({ ...prev, [item.id]: n }))}
                      className="erp-input"
                    />
                    <input type="hidden" name="unit_price" value={price} />
                  </td>
                  <td className="num">{(price * item.quantity).toLocaleString()}</td>
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
