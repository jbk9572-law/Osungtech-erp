"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { ProductSearchSelect } from "@/components/product-search-select";
import { QuantityWithBoxInput } from "@/components/quantity-with-box-input";
import { formatTodoMemoLine } from "@/lib/todo-memo";

type Product = {
  id: string;
  sku: string;
  name: string;
  spec?: string | null;
  unit?: string | null;
  base_package_qty?: number | null;
};

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

  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [itemProductId, setItemProductId] = useState("");
  const [itemQty, setItemQty] = useState(0);
  const selectedItemProduct = products.find((p) => p.id === itemProductId);

  function addItemLine() {
    if (!selectedItemProduct || itemQty <= 0) return;
    const line = formatTodoMemoLine(
      selectedItemProduct.name,
      selectedItemProduct.spec ?? "",
      itemQty
    );
    setMemo((prev) => (prev ? `${prev}\n${line}` : line));
    setItemProductId("");
    setItemQty(0);
  }

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input
        name="title"
        placeholder="할 일"
        required
        defaultValue={initial?.title}
        className="erp-input md:col-span-2"
      />
      <input name="due_date" type="date" defaultValue={initial?.dueDate ?? ""} className="erp-input" />

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
