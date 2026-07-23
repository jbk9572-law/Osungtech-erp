"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { ProductSearchSelect } from "@/components/product-search-select";
import { QuantityWithBoxInput } from "@/components/quantity-with-box-input";
import { formatTodoMemoLine } from "@/lib/todo-memo";
import {
  getPaperCalculationsForPurchaseOrder,
  getPurchaseItemsForDate,
  type TodayPurchaseItem,
} from "@/app/(dashboard)/purchases/actions";
import { mergePaperCalcInputItems, type PaperCalcSizeRow } from "@/lib/paper-calc-summary";
import { PAPER_STOCK_SKU } from "@/lib/paper-calc-sync";

type Product = {
  id: string;
  sku: string;
  name: string;
  spec?: string | null;
  unit?: string | null;
  base_package_qty?: number | null;
};

function todayStr() {
  return new Date().toLocaleDateString("sv-SE");
}

export function TodoForm({
  action,
  submitLabel = "등록",
  initial,
  products = [],
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel?: string;
  initial?: { id: string; title: string; memo: string; dueDate: string | null };
  products?: Product[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [itemProductId, setItemProductId] = useState("");
  const [itemQty, setItemQty] = useState(0);
  const selectedItemProduct = products.find((p) => p.id === itemProductId);

  function appendMemoLines(lines: string[]) {
    if (!lines.length) return;
    setMemo((prev) => (prev ? [prev, ...lines].join("\n") : lines.join("\n")));
  }

  function addItemLine() {
    if (!selectedItemProduct || itemQty <= 0) return;
    appendMemoLines([formatTodoMemoLine(selectedItemProduct.name, selectedItemProduct.spec ?? "", itemQty)]);
    setItemProductId("");
    setItemQty(0);
  }

  // 우리 쪽 품목은 대부분 당일 입고 후 바로 당일 출고돼서 재고를 거의 안
  // 가져간다 — 그래서 "오늘 뭘 처리해야 하나"가 결국 "오늘 뭐가 입고됐나"랑
  // 거의 같다. 매출 등록의 "입고 불러오기"와 같은 방식으로, 할일에도 매입
  // 품목을 그대로 가져와 메모 줄로 붙일 수 있게 한다.
  const [purchaseLookupDate, setPurchaseLookupDate] = useState(todayStr());
  const [purchaseCandidates, setPurchaseCandidates] = useState<TodayPurchaseItem[] | null>(null);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [addedPurchaseItemIds, setAddedPurchaseItemIds] = useState<Set<string>>(new Set());
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  async function loadPurchasesForDate() {
    setLoadingPurchases(true);
    setAddedPurchaseItemIds(new Set());
    try {
      const items = await getPurchaseItemsForDate(purchaseLookupDate);
      setPurchaseCandidates(items);
    } finally {
      setLoadingPurchases(false);
    }
  }

  async function addPurchaseItem(item: TodayPurchaseItem) {
    setTitle((prev) => prev || item.supplierName);

    if (item.sku === PAPER_STOCK_SKU) {
      setAddingItemId(item.id);
      try {
        const calcs = await getPaperCalculationsForPurchaseOrder(item.purchaseOrderId);
        const sizes = calcs.reduce(
          (acc, calc) => mergePaperCalcInputItems(acc, calc.inputItems),
          [] as PaperCalcSizeRow[]
        );
        if (sizes.length > 0) {
          appendMemoLines(
            sizes.map((s) => formatTodoMemoLine(item.productName, `${s.width}×${s.height}`, s.qty))
          );
          setAddedPurchaseItemIds((prev) => new Set(prev).add(item.id));
          return;
        }
      } finally {
        setAddingItemId(null);
      }
    }

    appendMemoLines([formatTodoMemoLine(item.productName, item.spec, item.quantity)]);
    setAddedPurchaseItemIds((prev) => new Set(prev).add(item.id));
  }

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input
        name="title"
        placeholder="할 일"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="erp-input md:col-span-2"
      />
      <input name="due_date" type="date" defaultValue={initial?.dueDate ?? ""} className="erp-input" />

      <div className="erp-search md:col-span-3">
        <div className="erp-field" style={{ width: 140 }}>
          <label>매입 가져오기</label>
          <input
            type="date"
            value={purchaseLookupDate}
            onChange={(e) => setPurchaseLookupDate(e.target.value)}
            className="erp-input"
          />
        </div>
        <button type="button" onClick={loadPurchasesForDate} disabled={loadingPurchases} className="erp-btn">
          {loadingPurchases ? "불러오는 중..." : "조회"}
        </button>
      </div>

      {purchaseCandidates !== null && (
        <div className="erp-grid-wrap md:col-span-3" style={{ maxHeight: 220, overflowY: "auto" }}>
          {purchaseCandidates.length === 0 ? (
            <p className="erp-grid-empty">{purchaseLookupDate}에 입고된 품목이 없습니다.</p>
          ) : (
            <table className="erp-grid">
              <thead>
                <tr>
                  <th>품목</th>
                  <th>규격</th>
                  <th>거래처</th>
                  <th className="num">수량</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {purchaseCandidates.map((item) => {
                  const added = addedPurchaseItemIds.has(item.id);
                  const isAdding = addingItemId === item.id;
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.productName}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{item.spec || "규격 미지정"}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{item.supplierName}</td>
                      <td className="num">
                        {item.quantity.toLocaleString()}
                        {item.unit}
                      </td>
                      <td style={{ width: 90 }}>
                        <button
                          type="button"
                          onClick={() => addPurchaseItem(item)}
                          className="erp-btn"
                          style={{ minWidth: 0, height: 24, padding: "0 8px" }}
                          disabled={added || isAdding}
                        >
                          {added ? "추가됨" : isAdding ? "추가 중..." : "추가"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {products.length > 0 && (
        <div className="erp-search md:col-span-3">
          <div className="erp-field" style={{ flex: 1, minWidth: 200 }}>
            <label>품목 검색해서 메모에 추가</label>
            <ProductSearchSelect products={products} value={itemProductId} onChange={setItemProductId} />
          </div>
          <div className="erp-field" style={{ width: 140 }}>
            <label>수량</label>
            <QuantityWithBoxInput
              quantity={itemQty}
              onQuantityChange={setItemQty}
              basePackageQty={selectedItemProduct?.base_package_qty}
              unit={selectedItemProduct?.unit}
              className="erp-input"
            />
          </div>
          <button
            type="button"
            onClick={addItemLine}
            disabled={!selectedItemProduct || itemQty <= 0}
            className="erp-btn"
          >
            + 메모에 추가
          </button>
        </div>
      )}

      <textarea
        name="memo"
        placeholder="메모"
        rows={6}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        className="erp-input md:col-span-3"
        style={{ resize: "vertical" }}
      />
      <div className="md:col-span-3 flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 저장 중...
            </>
          ) : (
            `F7 ${submitLabel}`
          )}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
