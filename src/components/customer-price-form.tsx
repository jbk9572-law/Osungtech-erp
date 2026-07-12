"use client";

import { useActionState, useRef } from "react";
import { upsertCustomerPrice } from "@/app/(dashboard)/customers/actions";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

type Product = { id: string; sku: string; name: string };

export function CustomerPriceForm({
  customerId,
  products,
}: {
  customerId: string;
  products: Product[];
}) {
  const [state, formAction, pending] = useActionState(upsertCustomerPrice, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          "F7 저장"
        )}
      </button>
      <div className="md:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
