"use client";

import { useActionState, useMemo, useState } from "react";
import { adjustInventory } from "@/app/(dashboard)/inventory/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";
import { NumberInput } from "@/components/number-input";

type Product = { id: string; sku: string; name: string };
type Warehouse = { id: string; name: string };
type StockLevel = { product_id: string; warehouse_id: string; quantity: number };

export function InventoryAdjustForm({
  products,
  warehouses,
  stockLevels,
}: {
  products: Product[];
  warehouses: Warehouse[];
  stockLevels: StockLevel[];
}) {
  const [state, formAction, pending] = useActionState(adjustInventory, undefined);
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [direction, setDirection] = useState<"increase" | "decrease">("increase");
  const [amount, setAmount] = useState(0);

  const currentStock = useMemo(() => {
    if (!productId || !warehouseId) return null;
    const row = stockLevels.find(
      (s) => s.product_id === productId && s.warehouse_id === warehouseId
    );
    return row?.quantity ?? 0;
  }, [productId, warehouseId, stockLevels]);

  const signedQuantity = direction === "decrease" ? -amount : amount;

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="warehouse_id" value={warehouseId} />
      <input type="hidden" name="quantity" value={signedQuantity} />
      <div className="sm:col-span-2">
        <ProductSearchSelect products={products} value={productId} onChange={setProductId} />
      </div>
      <select
        value={warehouseId}
        onChange={(e) => setWarehouseId(e.target.value)}
        required
        className="erp-select"
      >
        <option value="" disabled>
          창고 선택
        </option>
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.name}
          </option>
        ))}
      </select>
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
      <NumberInput value={amount} onChange={setAmount} placeholder="수량" className="erp-input" />
      {currentStock !== null && (
        <p className="text-xs sm:col-span-5" style={{ color: "var(--erp-text-muted)" }}>
          현재 재고: {currentStock.toLocaleString()}개 → 조정 후:{" "}
          {(currentStock + signedQuantity).toLocaleString()}개
        </p>
      )}
      <input
        name="note"
        placeholder="사유 (예: 기초재고, 실사 조정)"
        className="erp-input sm:col-span-4"
      />
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary w-full">
        {pending ? "저장 중..." : "F7 재고 조정 등록"}
      </button>
      <div className="sm:col-span-5">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
