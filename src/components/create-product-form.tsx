"use client";

import { useActionState } from "react";
import { createProduct } from "@/app/(dashboard)/products/actions";
import { FormMessage } from "@/components/form-message";

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };

export function CreateProductForm({
  categories,
  suppliers,
}: {
  categories: Category[];
  suppliers: Supplier[];
}) {
  const [state, formAction, pending] = useActionState(createProduct, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <input
        name="sku"
        placeholder="SKU"
        required
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="name"
        placeholder="상품명"
        required
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <select
        name="category_id"
        defaultValue=""
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
        defaultValue=""
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="price"
        placeholder="판매가"
        type="number"
        step="0.01"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="cost"
        placeholder="원가"
        type="number"
        step="0.01"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="reorder_point"
        placeholder="재주문 기준 수량"
        type="number"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 sm:col-span-4 sm:w-32"
      >
        {pending ? "저장 중..." : "추가"}
      </button>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
