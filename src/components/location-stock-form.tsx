"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { setLocationStock } from "@/app/(dashboard)/inventory/locations/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";

type Product = { id: string; sku: string; name: string; spec?: string | null };

export function LocationStockForm({
  locationId,
  code,
  products,
}: {
  locationId: string;
  code: string;
  products: Product[];
}) {
  const [state, formAction, pending] = useActionState(setLocationStock, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState<number>(0);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local UI state in reaction to a server action result, not derived state
      setProductId("");
      setQuantity(0);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="product_id" value={productId} />
      <div style={{ minWidth: 260, flex: 1 }}>
        <ProductSearchSelect products={products} value={productId} onChange={setProductId} />
      </div>
      <div className="erp-field" style={{ minWidth: 100 }}>
        <label htmlFor="loc-qty">수량</label>
        <input
          id="loc-qty"
          name="quantity"
          type="number"
          min={0}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="erp-input"
        />
      </div>
      <button type="submit" disabled={pending || !productId} className="erp-btn erp-btn-primary">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          "등록/수정"
        )}
      </button>
      <div style={{ flexBasis: "100%" }}>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
