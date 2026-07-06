"use client";

import { useActionState } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };

type ProductInitial = {
  sku?: string | null;
  name?: string | null;
  category_id?: string | null;
  supplier_id?: string | null;
  unit?: string | null;
  price?: number | null;
  cost?: number | null;
  reorder_point?: number | null;
};

export function ProductForm({
  action,
  categories,
  suppliers,
  initial,
  idFieldValue,
  submitLabel = "저장",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  categories: Category[];
  suppliers: Supplier[];
  initial?: ProductInitial;
  idFieldValue?: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      {idFieldValue && <input type="hidden" name="id" value={idFieldValue} />}
      <input
        name="sku"
        placeholder="SKU"
        required
        defaultValue={initial?.sku ?? ""}
        className="erp-input"
      />
      <input
        name="name"
        placeholder="상품명"
        required
        defaultValue={initial?.name ?? ""}
        className="erp-input"
      />
      <select
        name="category_id"
        defaultValue={initial?.category_id ?? ""}
        className="erp-input"
      >
        <option value="">카테고리 선택</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <select
        name="supplier_id"
        defaultValue={initial?.supplier_id ?? ""}
        className="erp-input"
      >
        <option value="">공급업체 선택</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>
      <input
        name="unit"
        placeholder="단위 (ea)"
        defaultValue={initial?.unit ?? ""}
        className="erp-input"
      />
      <input
        name="price"
        placeholder="판매가"
        type="number"
        step="0.01"
        defaultValue={initial?.price ?? ""}
        className="erp-input"
      />
      <input
        name="cost"
        placeholder="원가"
        type="number"
        step="0.01"
        defaultValue={initial?.cost ?? ""}
        className="erp-input"
      />
      <input
        name="reorder_point"
        placeholder="재주문 기준 수량"
        type="number"
        defaultValue={initial?.reorder_point ?? ""}
        className="erp-input"
      />
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary sm:col-span-4">
        {pending ? "저장 중..." : `F7 ${submitLabel}`}
      </button>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
