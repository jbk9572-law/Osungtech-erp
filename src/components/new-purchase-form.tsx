"use client";

import { useActionState, useState } from "react";
import { createPurchase } from "@/app/(dashboard)/purchases/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";
import type { FormState } from "@/components/form-message";
import { NumberInput } from "@/components/number-input";

type Supplier = { id: string; name: string };
type Product = { id: string; sku: string; name: string; cost: number };
type Warehouse = { id: string; name: string };

type Row = {
  key: number;
  productId: string;
  quantity: number;
  unitCost: number;
  manualPrice: boolean;
};

export type PurchaseInitial = {
  id: string;
  supplierId: string;
  warehouseId: string;
  purchaseDate: string;
  memo: string;
  items: { productId: string; quantity: number; unitCost: number }[];
};

export function NewPurchaseForm({
  suppliers,
  products,
  warehouses,
  action = createPurchase,
  initial,
  submitLabel = "매입 등록",
}: {
  suppliers: Supplier[];
  products: Product[];
  warehouses: Warehouse[];
  action?: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: PurchaseInitial;
  submitLabel?: string;
}) {
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [warehouseId, setWarehouseId] = useState(initial?.warehouseId ?? "");
  const [purchaseDate, setPurchaseDate] = useState(
    () => initial?.purchaseDate ?? new Date().toISOString().slice(0, 10)
  );
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [rows, setRows] = useState<Row[]>(
    initial?.items.length
      ? initial.items.map((item, i) => ({ key: i, ...item, manualPrice: false }))
      : [{ key: 0, productId: "", quantity: 1, unitCost: 0, manualPrice: false }]
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [state, formAction, pending] = useActionState(action, undefined);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function handleProductChange(key: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateRow(key, { productId, unitCost: product ? Number(product.cost) : 0 });
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: nextKey, productId: "", quantity: 1, unitCost: 0, manualPrice: false },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  const total = rows.reduce((sum, row) => sum + row.quantity * row.unitCost, 0);

  const itemsJson = JSON.stringify(
    rows
      .filter((row) => row.productId && row.quantity > 0)
      .map((row) => ({ productId: row.productId, quantity: row.quantity, unitCost: row.unitCost }))
  );

  return (
    <form action={formAction} className="space-y-6">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="items" value={itemsJson} />

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">공급업체</label>
          <select
            name="supplier_id"
            required
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              공급업체 선택
            </option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">입고 창고</label>
          <select
            name="warehouse_id"
            required
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">매입일자</label>
          <input
            name="purchase_date"
            type="date"
            required
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">메모 (선택)</label>
          <input
            name="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">품목</h2>
          <button
            type="button"
            onClick={addRow}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            + 품목 추가
          </button>
        </div>

        <div className="space-y-3">
          {rows.map((row) => {
            const product = products.find((p) => p.id === row.productId);
            const recentCost = product ? Number(product.cost) : 0;
            return (
              <div key={row.key} className="rounded-md border border-gray-100 p-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
                  <div className="sm:col-span-5">
                    <ProductSearchSelect
                      products={products}
                      value={row.productId}
                      onChange={(productId) => handleProductChange(row.key, productId)}
                    />
                  </div>
                  <NumberInput
                    placeholder="수량"
                    value={row.quantity}
                    onChange={(n) => updateRow(row.key, { quantity: n })}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
                  />
                  <NumberInput
                    placeholder="매입단가"
                    value={row.unitCost}
                    onChange={(n) => updateRow(row.key, { unitCost: n })}
                    disabled={!row.manualPrice}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 sm:col-span-2"
                  />
                  <div className="text-sm text-gray-500 sm:col-span-2">
                    {(row.quantity * row.unitCost).toLocaleString()}원
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="text-sm text-red-600 hover:underline sm:col-span-1"
                  >
                    삭제
                  </button>
                </div>
                {row.productId && (
                  <label className="mt-1.5 flex items-center gap-1.5 pl-1 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={row.manualPrice}
                      onChange={(e) => {
                        const manualPrice = e.target.checked;
                        updateRow(row.key, {
                          manualPrice,
                          ...(manualPrice ? {} : { unitCost: recentCost }),
                        });
                      }}
                    />
                    직접입력 (최근단가: {recentCost.toLocaleString()}원)
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end border-t border-gray-100 pt-4 text-base font-semibold text-gray-900">
          매입 합계: {total.toLocaleString()}원
        </div>
      </div>

      <FormMessage state={state} />

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {pending ? "저장 중..." : submitLabel}
      </button>
    </form>
  );
}
