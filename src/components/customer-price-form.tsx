"use client";

import { useActionState } from "react";
import { upsertCustomerPrice } from "@/app/(dashboard)/customers/actions";
import { FormMessage } from "@/components/form-message";

type Product = { id: string; sku: string; name: string };

export function CustomerPriceForm({
  customerId,
  products,
}: {
  customerId: string;
  products: Product[];
}) {
  const [state, formAction, pending] = useActionState(upsertCustomerPrice, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <input type="hidden" name="customer_id" value={customerId} />
      <select
        name="product_id"
        required
        defaultValue=""
        className="erp-input"
      >
        <option value="" disabled>
          상품 선택
        </option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.sku} · {product.name}
          </option>
        ))}
      </select>
      <input
        name="unit_price"
        type="number"
        step="0.01"
        placeholder="판매단가"
        required
        className="erp-input"
      />
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? "저장 중..." : "F7 저장"}
      </button>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
