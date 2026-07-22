"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { adjustInventory } from "@/app/(dashboard)/inventory/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";
import { QuantityWithBoxInput } from "@/components/quantity-with-box-input";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

type Product = {
  id: string;
  sku: string;
  name: string;
  spec?: string | null;
  unit?: string | null;
  base_package_qty?: number | null;
};
type StockLevel = { product_id: string; warehouse_id: string; quantity: number };

export function InventoryAdjustForm({
  products,
  warehouseId,
  stockLevels,
}: {
  products: Product[];
  warehouseId: string;
  stockLevels: StockLevel[];
}) {
  const [state, formAction, pending] = useActionState(adjustInventory, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useKeyShortcut("F7", submitRef);
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState<"increase" | "decrease">("increase");
  const [amount, setAmount] = useState(0);

  // 저장에 성공해도 예전엔 방금 고른 상품/수량이 폼에 그대로 남아있어서,
  // 다음 조정을 하려면 매번 직접 지워야 했고 깜빡하면 같은 조정이 중복
  // 등록될 위험도 있었다. 성공 시 폼을 초기 상태로 되돌린다.
  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local UI state in reaction to a server action result, not derived state
      setProductId("");
      setDirection("increase");
      setAmount(0);
      formRef.current?.reset();
    }
  }, [state]);

  const currentStock = useMemo(() => {
    if (!productId) return null;
    const row = stockLevels.find(
      (s) => s.product_id === productId && s.warehouse_id === warehouseId
    );
    return row?.quantity ?? 0;
  }, [productId, warehouseId, stockLevels]);

  const signedQuantity = direction === "decrease" ? -amount : amount;
  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4 items-start">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="warehouse_id" value={warehouseId} />
      <input type="hidden" name="quantity" value={signedQuantity} />
      <div className="md:col-span-2">
        <ProductSearchSelect products={products} value={productId} onChange={setProductId} />
      </div>
      <div className="flex overflow-hidden rounded-sm border border-[#d9d9d9]">
        <button
          type="button"
          onClick={() => setDirection("increase")}
          className="flex-1 text-xs font-semibold"
          style={{
            padding: "0 10px",
            height: 30,
            background: direction === "increase" ? "var(--erp-primary)" : "#fff",
            color: direction === "increase" ? "#fff" : "var(--erp-text-muted)",
          }}
        >
          증가
        </button>
        <button
          type="button"
          onClick={() => setDirection("decrease")}
          className="flex-1 text-xs font-semibold"
          style={{
            padding: "0 10px",
            height: 30,
            background: direction === "decrease" ? "var(--erp-primary)" : "#fff",
            color: direction === "decrease" ? "#fff" : "var(--erp-text-muted)",
          }}
        >
          차감
        </button>
      </div>
      <QuantityWithBoxInput
        quantity={amount}
        onQuantityChange={setAmount}
        basePackageQty={selectedProduct?.base_package_qty}
        unit={selectedProduct?.unit}
        className="erp-input"
      />
      {currentStock !== null && (
        <p className="text-xs md:col-span-4" style={{ color: "var(--erp-text-muted)" }}>
          현재 재고: {currentStock.toLocaleString()}개 → 조정 후:{" "}
          {(currentStock + signedQuantity).toLocaleString()}개
        </p>
      )}
      <input
        name="note"
        placeholder="사유 (예: 기초재고, 실사 조정)"
        className="erp-input md:col-span-3"
      />
      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary w-full">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          "F7 재고 조정 등록"
        )}
      </button>
      <div className="md:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
