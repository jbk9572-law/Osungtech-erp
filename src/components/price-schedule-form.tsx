"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { schedulePriceChange } from "@/app/(dashboard)/customers/actions";
import { FormMessage } from "@/components/form-message";
import { ProductSearchSelect } from "@/components/product-search-select";

type Product = { id: string; sku: string; name: string; spec?: string | null };

export function PriceScheduleForm({
  customerId,
  products,
}: {
  customerId: string;
  products: Product[];
}) {
  const [state, formAction, pending] = useActionState(schedulePriceChange, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [productId, setProductId] = useState("");

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 예약 성공 시 상품 검색창을 비우는 동기화
      setProductId("");
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="product_id" value={productId} required />
      <ProductSearchSelect products={products} value={productId} onChange={setProductId} />
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
