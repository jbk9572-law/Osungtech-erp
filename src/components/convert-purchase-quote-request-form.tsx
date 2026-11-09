"use client";

import { useActionState, useState } from "react";
import { convertPurchaseQuoteRequest } from "@/app/(dashboard)/purchase-quote-requests/actions";
import { FormMessage } from "@/components/form-message";
import { ErpSelect } from "@/components/erp/erp-select";

export function ConvertPurchaseQuoteRequestForm({
  purchaseQuoteRequestId,
  suppliers,
}: {
  purchaseQuoteRequestId: string;
  suppliers: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(convertPurchaseQuoteRequest, undefined);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="purchase_quote_request_id" value={purchaseQuoteRequestId} />
      <ErpSelect
        name="supplier_id"
        value={supplierId}
        onChange={setSupplierId}
        required
        options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
      />
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending || suppliers.length === 0}>
        {pending ? "전환 중..." : "이 공급처로 확정하고 구매요청 전환"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
