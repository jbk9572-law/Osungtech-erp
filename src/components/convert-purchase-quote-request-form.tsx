"use client";

import { useActionState } from "react";
import { convertPurchaseQuoteRequest } from "@/app/(dashboard)/purchase-quote-requests/actions";
import { FormMessage } from "@/components/form-message";

export function ConvertPurchaseQuoteRequestForm({
  purchaseQuoteRequestId,
  suppliers,
}: {
  purchaseQuoteRequestId: string;
  suppliers: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(convertPurchaseQuoteRequest, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="purchase_quote_request_id" value={purchaseQuoteRequestId} />
      <select name="supplier_id" defaultValue={suppliers[0]?.id ?? ""} className="erp-input" style={{ width: "auto" }} required>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending || suppliers.length === 0}>
        {pending ? "전환 중..." : "이 공급처로 확정하고 구매요청 전환"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
