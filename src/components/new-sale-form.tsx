"use client";

import { useActionState, useMemo, useState } from "react";
import { createSale } from "@/app/(dashboard)/sales/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";
import type { FormState } from "@/components/form-message";
import { PriceHistoryHint } from "@/components/price-history-hint";
import { NumberInput } from "@/components/number-input";

type Customer = { id: string; name: string };
type Product = { id: string; sku: string; name: string; spec?: string | null; price: number };
type Warehouse = { id: string; name: string };
type CustomerPrice = { customer_id: string; product_id: string; unit_price: number };
type PriceHistoryEntry = {
  customerId: string;
  productId: string;
  unitPrice: number;
  orderDate: string;
};

type Row = {
  key: number;
  productId: string;
  quantity: number;
  unitPrice: number;
  manualPrice: boolean;
};

export type SaleInitial = {
  id: string;
  customerId: string;
  warehouseId: string;
  orderDate: string;
  memo: string;
  items: { productId: string; quantity: number; unitPrice: number }[];
};

export function NewSaleForm({
  customers,
  products,
  warehouses,
  prices,
  history,
  action = createSale,
  initial,
  submitLabel = "거래 등록 및 거래명세표 보기",
}: {
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  prices: CustomerPrice[];
  history: PriceHistoryEntry[];
  action?: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: SaleInitial;
  submitLabel?: string;
}) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [warehouseId, setWarehouseId] = useState(initial?.warehouseId ?? "");
  const [orderDate, setOrderDate] = useState(
    () => initial?.orderDate ?? new Date().toISOString().slice(0, 10)
  );
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [rows, setRows] = useState<Row[]>(
    initial?.items.length
      ? initial.items.map((item, i) => ({ key: i, ...item, manualPrice: false }))
      : [{ key: 0, productId: "", quantity: 1, unitPrice: 0, manualPrice: false }]
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [state, formAction, pending] = useActionState(action, undefined);

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const price of prices) {
      map.set(`${price.customer_id}:${price.product_id}`, Number(price.unit_price));
    }
    return map;
  }, [prices]);

  function resolvePrice(forCustomerId: string, productId: string) {
    const fromCustomer = priceMap.get(`${forCustomerId}:${productId}`);
    if (fromCustomer !== undefined) return fromCustomer;
    const product = products.find((p) => p.id === productId);
    return product ? Number(product.price) : 0;
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function handleProductChange(key: number, productId: string) {
    updateRow(key, { productId, unitPrice: resolvePrice(customerId, productId) });
  }

  function handleCustomerChange(newCustomerId: string) {
    setCustomerId(newCustomerId);
    setRows((prev) =>
      prev.map((row) =>
        row.productId && !row.manualPrice
          ? { ...row, unitPrice: resolvePrice(newCustomerId, row.productId) }
          : row
      )
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: nextKey, productId: "", quantity: 1, unitPrice: 0, manualPrice: false },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  function getHistoryFor(productId: string) {
    return history
      .filter((h) => h.customerId === customerId && h.productId === productId)
      .sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1));
  }

  const supplyAmount = rows.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
  const taxAmount = Math.round(supplyAmount * 0.1);
  const total = supplyAmount + taxAmount;

  const itemsJson = JSON.stringify(
    rows
      .filter((row) => row.productId && row.quantity > 0)
      .map((row) => ({ productId: row.productId, quantity: row.quantity, unitPrice: row.unitPrice }))
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
            <label>거래처</label>
            <select
              name="customer_id"
              required
              value={customerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              className="erp-select"
            >
              <option value="" disabled>
                거래처 선택
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          <div className="erp-field">
            <label>출고 창고</label>
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
            <label>거래일자</label>
            <input
              name="order_date"
              type="date"
              required
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
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
            const recentPrice = row.productId ? resolvePrice(customerId, row.productId) : 0;
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
                    placeholder="단가"
                    value={row.unitPrice}
                    onChange={(n) => updateRow(row.key, { unitPrice: n })}
                    disabled={!row.manualPrice}
                    className="erp-input disabled:bg-[#f5f6f8] disabled:text-[#9aa2ad] sm:col-span-2"
                  />
                  <div
                    className="text-right text-xs sm:col-span-2"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    {(row.quantity * row.unitPrice).toLocaleString()}원
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
                {row.productId && customerId && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 pl-1">
                    <label
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: "var(--erp-text-muted)" }}
                    >
                      <input
                        type="checkbox"
                        checked={row.manualPrice}
                        onChange={(e) => {
                          const manualPrice = e.target.checked;
                          updateRow(row.key, {
                            manualPrice,
                            ...(manualPrice ? {} : { unitPrice: recentPrice }),
                          });
                        }}
                      />
                      직접입력 (최근단가: {recentPrice.toLocaleString()}원)
                    </label>
                    <PriceHistoryHint history={getHistoryFor(row.productId)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="grid grid-cols-1 gap-1 border-t border-[#eef0f3] px-4 py-3 text-xs sm:grid-cols-12"
          style={{ color: "var(--erp-text-muted)" }}
        >
          <div className="hidden sm:col-span-9 sm:block" />
          <div className="flex flex-col items-end gap-1 sm:col-span-2">
            <div>공급가액: {supplyAmount.toLocaleString()}원</div>
            <div>부가세(10%): {taxAmount.toLocaleString()}원</div>
            <div className="text-sm font-bold" style={{ color: "var(--erp-text)" }}>
              합계: {total.toLocaleString()}원
            </div>
          </div>
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
