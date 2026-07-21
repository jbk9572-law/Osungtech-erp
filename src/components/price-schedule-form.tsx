"use client";

import { useActionState, useEffect, useRef } from "react";
import { schedulePriceChange } from "@/app/(dashboard)/customers/actions";
import { FormMessage } from "@/components/form-message";

type Product = { id: string; sku: string; name: string };

export function PriceScheduleForm({
  customerId,
  products,
}: {
  customerId: string;
  products: Product[];
}) {
  const [state, formAction, pending] = useActionState(schedulePriceChange, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <input type="hidden" name="customer_id" value={customerId} />
      <select name="product_id" required defaultValue="" className="erp-input">
        <option value="" disabled>
          상품 선택
        </option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.sku} · {product.name}
          </option>
        ))}
      </select>
      <input name="new_unit_price" type="number" step="0.01" placeholder="변경될 단가" required className="erp-input" />
      <input name="effective_date" type="date" required className="erp-input" />
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? "예약 중..." : "예약"}
      </button>
      <div className="md:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
