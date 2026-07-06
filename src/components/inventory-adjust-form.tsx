"use client";

import { useActionState, useState } from "react";
import { adjustInventory } from "@/app/(dashboard)/inventory/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";
import { NumberInput } from "@/components/number-input";

type Product = { id: string; sku: string; name: string };
type Warehouse = { id: string; name: string };

export function InventoryAdjustForm({
  products,
  warehouses,
}: {
  products: Product[];
  warehouses: Warehouse[];
}) {
  const [state, formAction, pending] = useActionState(adjustInventory, undefined);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(0);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="quantity" value={quantity} />
      <div className="sm:col-span-2">
        <ProductSearchSelect products={products} value={productId} onChange={setProductId} />
      </div>
      <select
        name="warehouse_id"
        required
        defaultValue=""
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
      <NumberInput
        value={quantity}
        onChange={setQuantity}
        allowNegative
        placeholder="수량 (증가: 양수, 차감: 음수)"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="note"
        placeholder="사유 (예: 기초재고, 실사 조정)"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 sm:col-span-5 sm:w-40"
      >
        {pending ? "저장 중..." : "재고 조정 등록"}
      </button>
      <div className="sm:col-span-5">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
