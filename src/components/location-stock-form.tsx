"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { setLocationStock } from "@/app/(dashboard)/inventory/locations/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";
import { PageGuide } from "@/components/erp/page-guide";
import { formatQuantityWithBoxes } from "@/lib/package-qty";

type Product = {
  id: string;
  sku: string;
  name: string;
  spec?: string | null;
  totalQuantity: number;
  basePackageQty: number | null;
};

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

  // 한 품목이 여러 위치(구획)에 나뉘어 보관되는 경우가 흔해서, 창고 전체
  // 재고를 자동으로 채워버리면 오히려 방해가 된다 — 이 위치엔 실제로
  // 얼마나 있는지 사람이 직접 세어서 입력해야 정확하다. 그래서 수량은
  // 항상 수기 입력이고, 참고용으로 "아직 배정 안 된 재고" 숫자만
  // 안내문으로 보여준다.
  function handleProductChange(id: string) {
    setProductId(id);
    setQuantity(0);
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
        {selectedProduct?.basePackageQty != null && (
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", marginTop: 2 }}>
            {formatQuantityWithBoxes(quantity, selectedProduct.basePackageQty)}
          </div>
        )}
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
            ? `창고 전체 재고 중 아직 다른 위치에 배정하지 않은 재고: ${selectedProduct.totalQuantity.toLocaleString()}개 (참고용, 자동으로 채워지지 않습니다) — 이 위치에 실제로 보관 중인 수량을 직접 세어서 입력하세요. 포장수량이 있는 품목은 입력한 수량이 몇 박스인지 아래에 바로 표시됩니다.`
            : "품목을 고르면 참고용으로 창고 전체 재고 중 아직 다른 위치에 배정하지 않은 수량을 보여줍니다. 이 위치 보관수량은 자동으로 채워지지 않으니 실제로 있는 수량을 직접 입력하세요."}
        </PageGuide>
      </div>
      <div style={{ flexBasis: "100%" }}>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
