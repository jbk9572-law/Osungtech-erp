"use client";

import { useActionState } from "react";
import { convertQuoteToSale } from "@/app/(dashboard)/quotes/actions";
import { FormMessage } from "@/components/form-message";

export function ConvertQuoteForm({
  quoteId,
  warehouses,
}: {
  quoteId: string;
  warehouses: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(convertQuoteToSale, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="quote_id" value={quoteId} />
      <select name="warehouse_id" defaultValue={warehouses[0]?.id ?? ""} className="erp-input" style={{ width: "auto" }} required>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending || warehouses.length === 0}>
        {pending ? "전환 중..." : "매출로 전환"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
