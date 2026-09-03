"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { ProductSearchSelect } from "@/components/product-search-select";
import { PartySearchSelect } from "@/components/party-search-select";
import { QuickAddProductSearch } from "@/components/quick-add-product-search";
import { QuantityWithBoxInput } from "@/components/quantity-with-box-input";
import { PaperCalcModalTrigger } from "@/components/paper-calc/paper-calc-modal-trigger";
import type { PendingCalcPayload } from "@/components/paper-calc/paper-calc-client";
import { PENDING_PAPER_CALC_TODO_KEY } from "@/lib/paper-calc-pending-key";
import { parseTodoType, type TodoType } from "@/lib/todo-flow";
import { FieldHint } from "@/components/field-hint";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { focusSameColumnNextRow, focusGridArrowNav } from "@/lib/grid-enter-nav";

type Product = {
  id: string;
  sku: string;
  name: string;
  spec?: string | null;
  unit?: string | null;
  base_package_qty?: number | null;
  cost?: number | null;
  price?: number | null;
};

type Partner = { id: string; name: string };

type Row = {
  key: number;
  productId: string;
  spec: string;
  manualSpec: boolean;
  lotNumber: string;
  quantity: number;
};

export type TodoInitialItem = {
  productId: string;
  spec?: string | null;
  quantity: number;
  lotNumber?: string | null;
};

export function TodoForm({
  action,
  submitLabel = "등록",
  initial,
  products = [],
  suppliers = [],
  customers = [],
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel?: string;
  initial?: {
    id: string;
    title: string;
    memo: string;
    dueDate: string | null;
    items: TodoInitialItem[];
    todoType?: string;
    shipDate?: string | null;
    supplierId?: string | null;
    customerId?: string | null;
  };
  products?: Product[];
  suppliers?: Partner[];
  customers?: Partner[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [todoType, setTodoType] = useState<TodoType>(parseTodoType(initial?.todoType));
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [rows, setRows] = useState<Row[]>(
    initial?.items.length
      ? initial.items.map((item, i) => ({
          key: i,
          productId: item.productId,
          spec: item.spec ?? "",
          manualSpec: Boolean(item.spec),
          lotNumber: item.lotNumber ?? "",
          quantity: item.quantity,
        }))
      : []
  );
  const [nextKey, setNextKey] = useState(rows.length);

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: nextKey, productId: "", spec: "", manualSpec: false, lotNumber: "", quantity: 0 },
    ]);
    setNextKey((k) => k + 1);
  }

  // 검색창에서 Enter로 바로 추가할 때 쓴다 — "+ 품목 추가"로 빈 줄을
  // 만들고 그 안에서 다시 검색하는 2단계 대신, 검색해서 고른 품목이
  // 바로 채워진 새 줄을 만든다.
  function quickAddProduct(productId: string) {
    const product = products.find((p) => p.id === productId);
    const newRow: Row = {
      key: nextKey,
      productId,
      spec: product?.spec ?? "",
      manualSpec: false,
      lotNumber: "",
      quantity: 0,
    };
    setRows((prev) =>
      prev.length === 1 && !prev[0].productId && prev[0].quantity === 0 ? [newRow] : [...prev, newRow]
    );
    setNextKey((k) => k + 1);
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function handleProductChange(key: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateRow(key, { productId, spec: product?.spec ?? "" });
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  // 신규 등록일 때만 의미가 있다: 수정 화면은 이미 todo id가 있어서 모조지
  // 계산 화면에서 바로 저장하면 되고, 여기서 또 붙일 필요가 없다(매입/매출
  // 등록 폼과 동일한 제약). 이 값을 채우는 경로도 두 가지다.
  // 1) 이 폼 안의 모달(PaperCalcModalTrigger)에서 "이 계산 적용하기"를
  //    누르면 onApply 콜백으로 바로 이 state에 꽂힌다.
  // 2) 트리메뉴/탭바를 통해 독립적으로 연 "확장모듈 > 모조지 계산" 화면에서
  //    미리 테스트 계산을 해보고 "새 할일 등록에 연결"을 누른 경우 —
  //    localStorage에 잠깐 담아뒀다가 이 폼이 마운트될 때 읽어온다.
  const [pendingPaperCalc, setPendingPaperCalc] = useState<string | null>(null);
  function handlePaperCalcApply(payload: PendingCalcPayload) {
    setPendingPaperCalc(JSON.stringify(payload));
  }

  useEffect(() => {
    if (initial?.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount
    setPendingPaperCalc(localStorage.getItem(PENDING_PAPER_CALC_TODO_KEY));

    function handleStorage(e: StorageEvent) {
      if (e.key === PENDING_PAPER_CALC_TODO_KEY) {
        setPendingPaperCalc(e.newValue);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [initial?.id]);

  const pendingCalcSummary = (() => {
    if (!pendingPaperCalc) return null;
    try {
      const parsed = JSON.parse(pendingPaperCalc) as { totalSheet: number };
      return parsed.totalSheet > 0 ? parsed.totalSheet : null;
    } catch {
      return null;
    }
  })();

  const itemsJson = JSON.stringify(
    rows
      .filter((row) => row.productId && row.quantity > 0)
      .map((row) => ({
        productId: row.productId,
        // manualSpec은 "직접입력" 칸을 편집 가능하게 할지만 정하는 UI
        // 상태다 — row.spec 자체는 품목을 고르는 순간 그 품목의 기본
        // 규격으로 항상 채워져 있다(handleProductChange/quickAddProduct
        // 참고). 그런데 저장할 땐 manualSpec이 false면(대부분의 경우,
        // 즉 기본 규격을 그대로 쓴 경우) 무조건 null을 보내고 있었다 —
        // 화면엔 규격이 멀쩡히 보이는데 저장하고 다시 열면 사라지는
        // 버그였다. 실제로 편집 가능했는지와 무관하게, 화면에 보이는
        // 값을 그대로 저장한다.
        spec: row.spec || null,
        quantity: row.quantity,
        lotNumber: row.lotNumber || null,
      }))
  );

  return (
    <form
      action={formAction}
      className="space-y-4"
      onKeyDown={preventEnterSubmit}
      onSubmit={() => {
        // 제출 시점에 임시 계산을 같이 넘기고 나면 더 이상 필요 없으니 지운다
        // (모달 콜백으로 들어온 값은 애초에 localStorage에 쓴 적이 없어 지울
        // 것도 없다). 등록이 실패해도 계산 자체는 다시 하면 되므로 감수할
        // 만한 트레이드오프다.
        if (pendingPaperCalc) localStorage.removeItem(PENDING_PAPER_CALC_TODO_KEY);
      }}
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="items" value={itemsJson} />
      {pendingPaperCalc && <input type="hidden" name="pendingPaperCalc" value={pendingPaperCalc} />}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          name="title"
          placeholder="할 일 (비우면 거래처·유형으로 자동 생성)"
          aria-label="할 일"
          defaultValue={initial?.title}
          className="erp-input md:col-span-2"
        />
        <input
          name="due_date"
          type="date"
          aria-label="마감일"
          defaultValue={initial?.dueDate ?? ""}
          className="erp-input"
        />
      </div>

      <div className="erp-search">
        <div className="erp-field">
          <label>
            유형
            <FieldHint text="매입/매출 등록 화면에서 '할일 가져오기'로 이 할일을 불러와 등록해야 완료 처리됩니다. 매입+출고는 입고와 출고 둘 다 등록해야 완료됩니다." />
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 14, height: 30 }}>
            {(
              [
                { value: "purchase", label: "매입" },
                { value: "sale", label: "매출 (재고분 출고)" },
                { value: "both", label: "매입+출고" },
              ] as { value: TodoType; label: string }[]
            ).map((opt) => (
              <label
                key={opt.value}
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, cursor: "pointer" }}
              >
                <input
                  type="radio"
                  name="todo_type"
                  value={opt.value}
                  checked={todoType === opt.value}
                  onChange={() => setTodoType(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        {todoType !== "sale" && (
          <div className="erp-field">
            <label htmlFor="todo-supplier">공급처</label>
            <PartySearchSelect
              id="todo-supplier"
              name="supplier_id"
              parties={suppliers}
              value={supplierId}
              onChange={setSupplierId}
              placeholder="공급처명 검색"
            />
          </div>
        )}
        {todoType !== "purchase" && (
          <div className="erp-field">
            <label htmlFor="todo-customer">출고처</label>
            <PartySearchSelect
              id="todo-customer"
              name="customer_id"
              parties={customers}
              value={customerId}
              onChange={setCustomerId}
              placeholder="출고처명 검색"
            />
          </div>
        )}
        {todoType === "both" && (
          <div className="erp-field">
            <label htmlFor="todo-ship-date">출고예정일 (비우면 마감일 당일출고)</label>
            <input id="todo-ship-date" name="ship_date" type="date" defaultValue={initial?.shipDate ?? ""} className="erp-input" />
          </div>
        )}
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs" style={{ justifyContent: "space-between" }}>
          <span className="erp-detail-tab active">품목</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, margin: 4, flexWrap: "wrap" }}>
            <QuickAddProductSearch products={products} onAdd={quickAddProduct} />
            <button type="button" onClick={addRow} className="erp-btn" style={{ minWidth: 0 }}>
              + 품목 추가
            </button>
            {!initial?.id && <PaperCalcModalTrigger pendingFor="todo" onApply={handlePaperCalcApply} />}
          </div>
        </div>

        {pendingCalcSummary && (
          <div
            className="mb-2 flex items-center justify-between gap-2 rounded p-2 text-xs"
            style={{ background: "var(--erp-info-bg)", color: "var(--erp-info-text)", border: "1px solid var(--erp-info-border)" }}
          >
            <span>모조지 계산 연결됨 — {pendingCalcSummary.toLocaleString()}연</span>
            <button
              type="button"
              className="erp-btn erp-btn-danger"
              style={{ minWidth: 0, height: 22, padding: "0 8px" }}
              onClick={() => {
                localStorage.removeItem(PENDING_PAPER_CALC_TODO_KEY);
                setPendingPaperCalc(null);
              }}
            >
              취소
            </button>
          </div>
        )}

        <div className="erp-grid-wrap" style={{ border: "none", borderRadius: 0 }}>
          <table className="erp-grid" style={{ tableLayout: "fixed", width: "100%", minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ width: "24%" }}>품목</th>
                <th style={{ width: "14%" }}>규격</th>
                <th style={{ width: "16%" }}>관리번호</th>
                <th style={{ width: "7%" }}>단위</th>
                <th className="num" style={{ width: "16%" }}>
                  수량
                </th>
                <th className="num" style={{ width: "15%" }}>
                  {todoType === "sale" ? "예상 매출액" : "예상 매입액"}
                </th>
                <th style={{ width: "8%" }} />
              </tr>
            </thead>
            <tbody
              onKeyDown={(e) => {
                focusSameColumnNextRow(e);
                focusGridArrowNav(e);
              }}
            >
              {rows.map((row) => {
                const product = products.find((p) => p.id === row.productId);
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
                        aria-label="규격"
                        value={row.spec}
                        onChange={(e) => updateRow(row.key, { spec: e.target.value })}
                        disabled={!row.manualSpec}
                        className="erp-input w-full disabled:bg-[var(--erp-bg-disabled)] disabled:text-[var(--erp-text-muted)]"
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
                    <td>
                      <input
                        type="text"
                        placeholder="관리번호"
                        aria-label="관리번호"
                        value={row.lotNumber}
                        onChange={(e) => updateRow(row.key, { lotNumber: e.target.value })}
                        className="erp-input w-full"
                      />
                    </td>
                    <td style={{ color: "var(--erp-text-muted)" }}>{product?.unit ?? "-"}</td>
                    <td className="num">
                      <QuantityWithBoxInput
                        quantity={row.quantity}
                        onQuantityChange={(n) => updateRow(row.key, { quantity: n })}
                        basePackageQty={product?.base_package_qty}
                        className="erp-input w-full"
                      />
                    </td>
                    <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                      {(() => {
                        const unitPrice = todoType === "sale" ? product?.price : product?.cost;
                        if (!product || !unitPrice || row.quantity <= 0) return "-";
                        return `${(unitPrice * row.quantity).toLocaleString()}원`;
                      })()}
                    </td>
                    <td className="num">
                      <button
                        type="button"
                        className="erp-btn erp-btn-danger"
                        style={{ minWidth: 0, height: 26, padding: "0 8px" }}
                        onClick={() => removeRow(row.key)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="erp-grid-empty">
                    등록된 품목이 없습니다. &quot;+ 품목 추가&quot;로 추가해주세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <label htmlFor="todo-memo" className="mb-1 block text-xs" style={{ color: "var(--erp-text-muted)" }}>
          메모 (품목과 무관한 참고 메모)
        </label>
        <textarea
          id="todo-memo"
          name="memo"
          placeholder="메모"
          rows={4}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="erp-input w-full"
          style={{ resize: "vertical" }}
        />
      </div>

      <div className="flex items-center gap-2">
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
