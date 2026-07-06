"use client";

import { useMemo, useState } from "react";
import { createSale } from "@/app/(dashboard)/sales/actions";

type Customer = { id: string; name: string };
type Product = { id: string; sku: string; name: string; price: number };
type Warehouse = { id: string; name: string };
type CustomerPrice = { customer_id: string; product_id: string; unit_price: number };

type Row = {
  key: number;
  productId: string;
  quantity: number;
  unitPrice: number;
};

export function NewSaleForm({
  customers,
  products,
  warehouses,
  prices,
}: {
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  prices: CustomerPrice[];
}) {
  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [rows, setRows] = useState<Row[]>([{ key: 0, productId: "", quantity: 1, unitPrice: 0 }]);
  const [nextKey, setNextKey] = useState(1);

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
        row.productId ? { ...row, unitPrice: resolvePrice(newCustomerId, row.productId) } : row
      )
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { key: nextKey, productId: "", quantity: 1, unitPrice: 0 }]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
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
    <form action={createSale} className="space-y-6">
      <input type="hidden" name="items" value={itemsJson} />

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">거래처</label>
          <select
            name="customer_id"
            required
            value={customerId}
            onChange={(e) => handleCustomerChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">출고 창고</label>
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
          <label className="mb-1 block text-sm font-medium text-gray-700">거래일자</label>
          <input
            name="order_date"
            type="date"
            required
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
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
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
              <select
                value={row.productId}
                onChange={(e) => handleProductChange(row.key, e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-5"
              >
                <option value="">상품 선택</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                placeholder="수량"
                value={row.quantity}
                onChange={(e) => updateRow(row.key, { quantity: Number(e.target.value) })}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                type="number"
                step="0.01"
                placeholder="단가"
                value={row.unitPrice}
                onChange={(e) => updateRow(row.key, { unitPrice: Number(e.target.value) })}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
              />
              <div className="text-sm text-gray-500 sm:col-span-2">
                {(row.quantity * row.unitPrice).toLocaleString()}원
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="text-sm text-red-600 hover:underline sm:col-span-1"
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col items-end gap-1 border-t border-gray-100 pt-4 text-sm">
          <div className="text-gray-500">공급가액: {supplyAmount.toLocaleString()}원</div>
          <div className="text-gray-500">부가세(10%): {taxAmount.toLocaleString()}원</div>
          <div className="text-base font-semibold text-gray-900">
            합계: {total.toLocaleString()}원
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
      >
        거래 등록 및 거래명세표 보기
      </button>
    </form>
  );
}
