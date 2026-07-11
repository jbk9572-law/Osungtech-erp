"use client";

import { useActionState, useRef, useState } from "react";
import { createPurchase } from "@/app/(dashboard)/purchases/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";
import type { FormState } from "@/components/form-message";
import { NumberInput } from "@/components/number-input";
import { QuantityWithBoxInput } from "@/components/quantity-with-box-input";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { focusSameColumnNextRow } from "@/lib/grid-enter-nav";

type Supplier = { id: string; name: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  spec?: string | null;
  unit?: string | null;
  cost: number;
  base_package_qty?: number | null;
};

type Row = {
  key: number;
  productId: string;
  spec: string;
  manualSpec: boolean;
  quantity: number;
  unitCost: number;
  manualPrice: boolean;
  remark: string;
};

export type PurchaseInitial = {
  id: string;
  supplierId: string;
  warehouseId: string;
  purchaseDate: string;
  memo: string;
  items: {
    productId: string;
    spec?: string | null;
    quantity: number;
    unitCost: number;
    remark?: string | null;
  }[];
};

export function NewPurchaseForm({
  suppliers,
  products,
  warehouseId,
  action = createPurchase,
  initial,
  submitLabel = "매입 등록",
}: {
  suppliers: Supplier[];
  products: Product[];
  warehouseId: string;
  action?: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: PurchaseInitial;
  submitLabel?: string;
}) {
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [purchaseDate, setPurchaseDate] = useState(
    () => initial?.purchaseDate ?? new Date().toISOString().slice(0, 10)
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
          unitCost: item.unitCost,
          manualPrice: false,
          remark: item.remark ?? "",
        }))
      : [
          {
            key: 0,
            productId: "",
            spec: "",
            manualSpec: false,
            quantity: 0,
            unitCost: 0,
            manualPrice: false,
            remark: "",
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

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function handleProductChange(key: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateRow(key, {
      productId,
      spec: product?.spec ?? "",
      unitCost: product ? Number(product.cost) : 0,
    });
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
        unitCost: 0,
        manualPrice: false,
        remark: "",
      },
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
      .map((row) => ({
        productId: row.productId,
        // 직접입력이 아니면 규격을 스냅샷으로 고정하지 않고 null로 저장해서,
        // 품목관리에서 마스터 규격을 나중에 고쳐도 계속 최신값을 따라가게 한다.
        spec: row.manualSpec ? row.spec : null,
        quantity: row.quantity,
        unitCost: row.unitCost,
        remark: row.remark || null,
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

        <div className="erp-grid-wrap" style={{ border: "none", borderRadius: 0, minHeight: "50vh" }}>
          <table className="erp-grid" style={{ tableLayout: "fixed", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: "20%" }}>품목</th>
                <th style={{ width: "10%" }}>규격</th>
                <th style={{ width: "6%" }}>단위</th>
                <th className="num" style={{ width: "16%" }}>
                  수량
                </th>
                <th className="num" style={{ width: "15%" }}>
                  매입단가
                </th>
                <th className="num" style={{ width: "15%" }}>
                  금액
                </th>
                <th style={{ width: "12%" }}>비고</th>
                <th style={{ width: "6%" }} />
              </tr>
            </thead>
            <tbody onKeyDown={focusSameColumnNextRow}>
              {rows.map((row) => {
                const product = products.find((p) => p.id === row.productId);
                const recentCost = product ? Number(product.cost) : 0;
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
                      <QuantityWithBoxInput
                        quantity={row.quantity}
                        onQuantityChange={(n) => updateRow(row.key, { quantity: n })}
                        basePackageQty={product?.base_package_qty}
                        unit={product?.unit}
                        allowFormula
                      />
                    </td>
                    <td className="num">
                      <NumberInput
                        placeholder="매입단가"
                        value={row.unitCost}
                        onChange={(n) => updateRow(row.key, { unitCost: n })}
                        disabled={!row.manualPrice}
                        className="erp-input w-full disabled:bg-[#f5f6f8] disabled:text-[#9aa2ad]"
                      />
                      {row.productId && (
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
                                ...(manualPrice ? {} : { unitCost: recentCost }),
                              });
                            }}
                          />
                          직접입력
                        </label>
                      )}
                    </td>
                    <td className="num">{(row.quantity * row.unitCost).toLocaleString()}원</td>
                    <td>
                      <input
                        type="text"
                        placeholder="비고"
                        value={row.remark}
                        onChange={(e) => updateRow(row.key, { remark: e.target.value })}
                        className="erp-input w-full"
                      />
                    </td>
                    <td className="num">
                      <button
                        type="button"
                        className="erp-btn erp-btn-danger"
                        style={{ minWidth: 0, height: 26, padding: "0 8px" }}
                        onClick={() => removeRow(row.key)}
                        disabled={rows.length <= 1}
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
                  매입 합계
                </td>
                <td className="num text-sm font-bold" colSpan={3} style={{ color: "var(--erp-text)" }}>
                  {total.toLocaleString()}원
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
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
