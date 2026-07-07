"use client";

import { useActionState, useState } from "react";
import { createPurchase } from "@/app/(dashboard)/purchases/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";
import type { FormState } from "@/components/form-message";
import { NumberInput } from "@/components/number-input";

type Supplier = { id: string; name: string };
type Product = { id: string; sku: string; name: string; spec?: string | null; cost: number };
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

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기본정보</span>
        </div>
        <div className="erp-detail-body erp-search" style={{ border: "none", padding: 0, margin: 0 }}>
          <div className="erp-field">
            <label>공급업체</label>
            <select
              name="supplier_id"
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="erp-select"
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
          <div className="erp-field">
            <label>입고 창고</label>
            <select
              name="warehouse_id"
              required
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
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
          </div>
          <div className="erp-field">
            <label>매입일자</label>
            <input
              name="purchase_date"
              type="date"
              required
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="erp-input"
            />
          </div>
          <div className="erp-field" style={{ flex: 1, minWidth: 220 }}>
            <label>메모 (선택)</label>
            <input
              name="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="erp-input"
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs" style={{ justifyContent: "space-between" }}>
          <span className="erp-detail-tab active">품목</span>
          <button type="button" onClick={addRow} className="erp-btn" style={{ margin: 4, minWidth: 0 }}>
            + 품목 추가
          </button>
        </div>

        <div className="erp-detail-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row) => {
            const product = products.find((p) => p.id === row.productId);
            const recentCost = product ? Number(product.cost) : 0;
            return (
              <div key={row.key} className="rounded-sm border border-[#eef0f3] p-2">
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
                    className="erp-input sm:col-span-2"
                  />
                  <NumberInput
                    placeholder="매입단가"
                    value={row.unitCost}
                    onChange={(n) => updateRow(row.key, { unitCost: n })}
                    disabled={!row.manualPrice}
                    className="erp-input disabled:bg-[#f5f6f8] disabled:text-[#9aa2ad] sm:col-span-2"
                  />
                  <div
                    className="text-right text-xs sm:col-span-2"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    {(row.quantity * row.unitCost).toLocaleString()}원
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="text-xs font-medium sm:col-span-1"
                    style={{ color: "#dc3545" }}
                  >
                    삭제
                  </button>
                </div>
                {row.productId && (
                  <label
                    className="mt-1.5 flex items-center gap-1.5 pl-1 text-xs"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
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

        <div
          className="grid grid-cols-1 gap-1 border-t border-[#eef0f3] px-4 py-3 text-sm font-bold sm:grid-cols-12"
          style={{ color: "var(--erp-text)" }}
        >
          <div className="hidden sm:col-span-9 sm:block" />
          <div className="text-right sm:col-span-2">매입 합계: {total.toLocaleString()}원</div>
          <div className="hidden sm:col-span-1 sm:block" />
        </div>
      </div>

      <FormMessage state={state} />

      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? "저장 중..." : `F7 ${submitLabel}`}
      </button>
    </form>
  );
}
