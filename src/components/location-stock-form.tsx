"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { setLocationStock } from "@/app/(dashboard)/inventory/locations/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";
import { PageGuide } from "@/components/erp/page-guide";

type Product = { id: string; sku: string; name: string; spec?: string | null; totalQuantity: number };

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
  const selectedProduct = products.find((p) => p.id === productId);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local UI state in reaction to a server action result, not derived state
      setProductId("");
      setQuantity(0);
    }
  }, [state]);

  // 위치별 수량을 0부터 직접 입력하게 하면 막막하니, 품목을 고르면 창고
  // 전체 재고를 기본값으로 채워준다 — 이 위치엔 그중 일부만 있으면
  // 숫자만 고치면 된다.
  function handleProductChange(id: string) {
    setProductId(id);
    const product = products.find((p) => p.id === id);
    if (product) setQuantity(product.totalQuantity);
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="product_id" value={productId} />
      <div style={{ minWidth: 260, flex: 1 }}>
        <ProductSearchSelect products={products} value={productId} onChange={handleProductChange} />
      </div>
      <div className="erp-field" style={{ minWidth: 130 }}>
        <label htmlFor="loc-qty">이 위치 보관수량</label>
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
        <PageGuide className="mb-0">
          {selectedProduct
            ? `아직 다른 위치에 배정하지 않은 재고: ${selectedProduct.totalQuantity.toLocaleString()}개 — 이 위치 보관수량 칸에 기본값으로 채워뒀습니다. 이 위치엔 일부만 있으면 숫자를 고쳐주세요.`
            : "품목을 고르면 창고 전체 재고 중 아직 다른 위치에 배정하지 않은 수량이 이 위치 보관수량 칸에 자동으로 채워집니다. 이 위치에 실제로 있는 수량과 다르면 숫자를 고쳐서 등록하세요."}
        </PageGuide>
      </div>
      <div style={{ flexBasis: "100%" }}>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
