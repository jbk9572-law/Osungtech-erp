"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { createSale } from "@/app/(dashboard)/sales/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";
import type { FormState } from "@/components/form-message";
import { PriceHistoryHint } from "@/components/price-history-hint";
import { NumberInput } from "@/components/number-input";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { focusSameColumnNextRow } from "@/lib/grid-enter-nav";

type Customer = { id: string; name: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  spec?: string | null;
  unit?: string | null;
  price: number;
  stock?: number;
};
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
  spec: string;
  manualSpec: boolean;
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
  items: { productId: string; spec?: string | null; quantity: number; unitPrice: number }[];
};

export function NewSaleForm({
  customers,
  products,
  warehouseId,
  prices,
  history,
  action = createSale,
  initial,
  submitLabel = "매출 등록",
}: {
  customers: Customer[];
  products: Product[];
  warehouseId: string;
  prices: CustomerPrice[];
  history: PriceHistoryEntry[];
  action?: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: SaleInitial;
  submitLabel?: string;
}) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [orderDate, setOrderDate] = useState(
    () => initial?.orderDate ?? new Date().toISOString().slice(0, 10)
  );
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [rows, setRows] = useState<Row[]>(
    initial?.items.length
      ? initial.items.map((item, i) => ({
          key: i,
          productId: item.productId,
          spec: item.spec ?? "",
          manualSpec: Boolean(item.spec),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          manualPrice: false,
        }))
      : [
          {
            key: 0,
            productId: "",
            spec: "",
            manualSpec: false,
            quantity: 0,
            unitPrice: 0,
            manualPrice: false,
          },
        ]
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [state, formAction, pending] = useActionState(action, undefined);
  // 등록 실패 메시지는 실제로 다시 제출하기 전까지는 useActionState가 값을
  // 갱신하지 않는다. 값을 수정한 뒤에도 이전 실패 메시지가 그대로 남아있으면
  // "고쳤는데도 계속 실패한다"고 오해하게 되므로, 입력을 건드리는 순간
  // 화면에서만 숨긴다 (다시 제출하면 onSubmit에서 원복해 새 결과를 보여줌).
  const [messageDismissed, setMessageDismissed] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

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
    const product = products.find((p) => p.id === productId);
    updateRow(key, {
      productId,
      spec: product?.spec ?? "",
      unitPrice: resolvePrice(customerId, productId),
    });
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
      {
        key: nextKey,
        productId: "",
        spec: "",
        manualSpec: false,
        quantity: 0,
        unitPrice: 0,
        manualPrice: false,
      },
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
      .map((row) => ({
        productId: row.productId,
        // 직접입력이 아니면 규격을 스냅샷으로 고정하지 않고 null로 저장해서,
        // 품목관리에서 마스터 규격을 나중에 고쳐도 계속 최신값을 따라가게 한다.
        spec: row.manualSpec ? row.spec : null,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
      }))
  );

  return (
    <form
      action={formAction}
      className="space-y-6"
      onKeyDown={preventEnterSubmit}
      onChangeCapture={() => setMessageDismissed(true)}
      onClickCapture={() => setMessageDismissed(true)}
      onSubmit={() => setMessageDismissed(false)}
    >
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="warehouse_id" value={warehouseId} />
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

        <div className="erp-grid-wrap" style={{ border: "none", borderRadius: 0, minHeight: "50vh" }}>
          <table className="erp-grid" style={{ tableLayout: "fixed", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: "22%" }}>품목</th>
                <th style={{ width: "12%" }}>규격</th>
                <th style={{ width: "7%" }}>단위</th>
                <th className="num" style={{ width: "18%" }}>
                  수량
                </th>
                <th className="num" style={{ width: "17%" }}>
                  단가
                </th>
                <th className="num" style={{ width: "17%" }}>
                  금액
                </th>
                <th style={{ width: "7%" }} />
              </tr>
            </thead>
            <tbody onKeyDown={focusSameColumnNextRow}>
              {rows.map((row) => {
                const product = products.find((p) => p.id === row.productId);
                const recentPrice = row.productId ? resolvePrice(customerId, row.productId) : 0;
                return (
                  <tr key={row.key}>
                    <td>
                      <ProductSearchSelect
                        products={products}
                        value={row.productId}
                        onChange={(productId) => handleProductChange(row.key, productId)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="규격"
                        value={row.spec}
                        onChange={(e) => updateRow(row.key, { spec: e.target.value })}
                        disabled={!row.manualSpec}
                        className="erp-input w-full disabled:bg-[#f5f6f8] disabled:text-[#9aa2ad]"
                      />
                      {row.productId && (
                        <label
                          className="mt-1 flex items-center gap-1 text-[10.5px]"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          <input
                            type="checkbox"
                            checked={row.manualSpec}
                            onChange={(e) => {
                              const manualSpec = e.target.checked;
                              updateRow(row.key, {
                                manualSpec,
                                ...(manualSpec ? {} : { spec: product?.spec ?? "" }),
                              });
                            }}
                          />
                          직접입력
                        </label>
                      )}
                    </td>
                    <td style={{ color: "var(--erp-text-muted)" }}>{product?.unit ?? "-"}</td>
                    <td className="num">
                      <NumberInput
                        placeholder="수량"
                        value={row.quantity}
                        onChange={(n) => updateRow(row.key, { quantity: n })}
                        className="erp-input w-full"
                      />
                    </td>
                    <td className="num">
                      <NumberInput
                        placeholder="단가"
                        value={row.unitPrice}
                        onChange={(n) => updateRow(row.key, { unitPrice: n })}
                        disabled={!row.manualPrice}
                        className="erp-input w-full disabled:bg-[#f5f6f8] disabled:text-[#9aa2ad]"
                      />
                      {row.productId && customerId && (
                        <label
                          className="mt-1 flex items-center justify-end gap-1 text-[10.5px]"
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
                          직접입력
                        </label>
                      )}
                    </td>
                    <td className="num">
                      {(row.quantity * row.unitPrice).toLocaleString()}원
                      {row.productId && product && (
                        <p
                          className="text-[10.5px]"
                          style={{
                            color: row.quantity > (product.stock ?? 0) ? "#dc3545" : "var(--erp-text-muted)",
                          }}
                        >
                          재고 {(product.stock ?? 0).toLocaleString()}{product.unit ?? ""}
                          {row.quantity > (product.stock ?? 0) && " · 부족"}
                        </p>
                      )}
                    </td>
                    <td className="num">
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        className="text-xs font-medium"
                        style={{ color: "#dc3545" }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "#eef1f5" }}>
                <td colSpan={5} style={{ fontWeight: 700 }}>
                  합계
                </td>
                <td className="num" colSpan={2}>
                  <div style={{ color: "var(--erp-text-muted)" }}>
                    공급가액 {supplyAmount.toLocaleString()}원 · 부가세 {taxAmount.toLocaleString()}원
                  </div>
                  <div className="text-sm font-bold" style={{ color: "var(--erp-text)" }}>
                    {total.toLocaleString()}원
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {rows.some((r) => r.productId && customerId && getHistoryFor(r.productId).length > 0) && (
          <div className="erp-detail-body" style={{ paddingTop: 8 }}>
            {rows
              .filter((r) => r.productId && customerId)
              .map((r) => {
                const hist = getHistoryFor(r.productId);
                if (!hist.length) return null;
                const product = products.find((p) => p.id === r.productId);
                return (
                  <div key={r.key} className="mb-1 flex items-center gap-2 text-xs">
                    <span style={{ color: "var(--erp-text-muted)" }}>{product?.name}:</span>
                    <PriceHistoryHint history={hist} />
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <FormMessage state={messageDismissed ? undefined : state} />

      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          `F7 ${submitLabel}`
        )}
      </button>
    </form>
  );
}
