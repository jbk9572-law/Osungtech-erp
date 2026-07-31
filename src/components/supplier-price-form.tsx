"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { upsertSupplierPrice } from "@/app/(dashboard)/suppliers/actions";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { ProductSearchSelect } from "@/components/product-search-select";

type Product = { id: string; sku: string; name: string; spec?: string | null };

export function SupplierPriceForm({
  supplierId,
  products,
}: {
  supplierId: string;
  products: Product[];
}) {
  const [state, formAction, pending] = useActionState(upsertSupplierPrice, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const [productId, setProductId] = useState("");

  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장 성공 시 상품 검색창을 비우는 동기화
      setProductId("");
    }
  }, [state]);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <input type="hidden" name="supplier_id" value={supplierId} />
      <input type="hidden" name="product_id" value={productId} required />
      <ProductSearchSelect products={products} value={productId} onChange={setProductId} />
      <input
        name="unit_cost"
        type="number"
        step="0.01"
        placeholder="매입단가"
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
