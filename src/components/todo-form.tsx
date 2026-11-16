"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { ProductSearchSelect } from "@/components/product-search-select";
import { PartySearchSelect } from "@/components/party-search-select";
import { QuickAddProductSearch } from "@/components/quick-add-product-search";
import { MobileItemEntryPanel } from "@/components/erp/mobile-item-entry-panel";
import { QuantityWithBoxInput } from "@/components/quantity-with-box-input";
import {
  TodoPaperCalcBanner,
  TodoPaperCalcHiddenInput,
  TodoPaperCalcToolbarButton,
  useTodoPaperCalc,
} from "@/modules/paper-calc/todo-form";
import { parseTodoType, type TodoType } from "@/lib/todo-flow";
import { FieldHint } from "@/components/field-hint";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { focusSameColumnNextRow, focusGridArrowNav } from "@/lib/grid-enter-nav";
import { normalizeLotNumber } from "@/lib/lot-number";
import { useFormRedirect } from "@/lib/use-form-redirect";
import { formatNumber } from "@/lib/format-number";
import { OrderImportPopover } from "@/components/order-import-popover";
import { getPurchaseItemsForDate } from "@/app/(dashboard)/purchases/actions";
import { getSaleItemsForDate } from "@/app/(dashboard)/sales/actions";
import { groupByOrder, type ImportableOrder, type ImportableOrderItem } from "@/lib/order-import";
import { todayKstStr } from "@/lib/kst-date";

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
  paperCalcEnabled = true,
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
  // 테넌트가 환경설정 > 기능 관리에서 "모조지 계산"을 꺼두면 false — new-sale-form.tsx와
  // 동일하게 계산 진입 버튼을 숨긴다(paper-calc-sync.ts의 isPaperCalcEnabled 참고).
  paperCalcEnabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  useFormRedirect(state);
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

  const pc = useTodoPaperCalc({ isEdit: !!initial?.id });

  // 이미 입력해 둔 매입/매출의 품목·규격·수량·관리번호(LOT)를 다시 치지 않고 할일 품목으로 옮겨 담는다.
  // 마감일·출고예정일은 일부러 건드리지 않는다 — 잊지 않으려고 적는 할일이라 날짜는 직접 정하는 게 핵심이다.
  const [importKind, setImportKind] = useState<null | "purchase" | "sale">(null);
  const [importDate, setImportDate] = useState(() => todayKstStr());
  const [importOrders, setImportOrders] = useState<ImportableOrder[] | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importFailed, setImportFailed] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  async function loadImportOrders(kind: "purchase" | "sale", date: string) {
    setImportLoading(true);
    setImportFailed(false);
    setImportOrders(null);
    try {
      const items: ImportableOrderItem[] =
        kind === "purchase"
          ? (await getPurchaseItemsForDate(date)).map((i) => ({
              id: i.id, orderId: i.purchaseOrderId, productId: i.productId, productName: i.productName, sku: i.sku, spec: i.spec,
              quantity: i.quantity, unit: i.unit, lotNumber: i.lotNumber, partnerId: i.supplierId, partnerName: i.supplierName,
            }))
          : await getSaleItemsForDate(date);
      setImportOrders(groupByOrder(items));
    } catch (error) {
      // 조회가 실패했는데 "불러올 품목이 없음"으로 보이면 원인을 알 수 없다 — 실패는 따로 보여 주고 기록한다.
      console.error("불러오기 조회 실패:", error);
      setImportFailed(true);
    } finally {
      setImportLoading(false);
    }
  }

  function openImport(kind: "purchase" | "sale") {
    setImportKind(kind);
    setImportMessage(null);
    void loadImportOrders(kind, importDate);
  }

  function applyImport(order: ImportableOrder) {
    // 같은 품목·관리번호·수량이 이미 있으면 건너뛴다(같은 거래를 두 번 불러와 줄이 겹치는 것 방지).
    const exists = (it: ImportableOrderItem) =>
      rows.some((r) => r.productId === it.productId && r.lotNumber === it.lotNumber && r.quantity === it.quantity);
    const fresh = order.items.filter((it) => !exists(it));
    let key = nextKey;
    const newRows: Row[] = fresh.map((it) => ({
      key: key++,
      productId: it.productId,
      spec: it.spec,
      manualSpec: Boolean(it.spec),
      lotNumber: it.lotNumber,
      quantity: it.quantity,
    }));
    if (newRows.length) {
      setRows((prev) => (prev.length === 1 && !prev[0].productId && prev[0].quantity === 0 ? newRows : [...prev, ...newRows]));
      setNextKey(key);
    }
    // 거래처는 비어 있고 이 할일 유형에 해당하는 쪽일 때만 채운다(이미 고른 값은 덮어쓰지 않는다).
    if (importKind === "purchase" && todoType !== "sale" && !supplierId && order.partnerId) setSupplierId(order.partnerId);
    if (importKind === "sale" && todoType !== "purchase" && !customerId && order.partnerId) setCustomerId(order.partnerId);
    const skipped = order.items.length - fresh.length;
    setImportMessage(`${order.partnerName}: 품목 ${newRows.length}건을 불러왔습니다${skipped ? ` (이미 있는 ${skipped}건은 건너뜀)` : ""}.`);
    setImportKind(null);
  }

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
      className="flex flex-col gap-4"
      onKeyDown={preventEnterSubmit}
      onSubmit={() => {
        // 제출 시점에 임시 계산을 같이 넘기고 나면 더 이상 필요 없으니 지운다
        // (모달 콜백으로 들어온 값은 애초에 localStorage에 쓴 적이 없어 지울
        // 것도 없다). 등록이 실패해도 계산 자체는 다시 하면 되므로 감수할
        // 만한 트레이드오프다.
        pc.clearStorageOnSubmit();
      }}
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="items" value={itemsJson} />
      <TodoPaperCalcHiddenInput pc={pc} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          name="title"
          autoComplete="off"
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

      <div className="erp-field-grid">
        <div className="erp-field erp-span-4">
          <label>
            유형
            <FieldHint text="매입/매출 등록 화면에서 '할일 가져오기'로 이 할일을 불러와 등록해야 완료 처리됩니다. 매입+출고는 입고와 출고 둘 다 등록해야 완료됩니다." />
          </label>
          <div className="erp-u-flex erp-u-items-center erp-u-gap-14 erp-u-h-30">
            {(
              [
                { value: "purchase", label: "매입" },
                { value: "sale", label: "매출 (재고분 출고)" },
                { value: "both", label: "매입+출고" },
              ] as { value: TodoType; label: string }[]
            ).map((opt) => (
              <label className="erp-u-flex erp-u-items-center erp-u-text-base erp-u-pointer"
                key={opt.value}
                style={{ gap: 5 }}
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
          <div className="erp-field erp-span-4">
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
          <div className="erp-field erp-span-4">
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
          <div className="erp-field erp-span-6">
            <label htmlFor="todo-ship-date">출고예정일 (비우면 마감일 당일출고)</label>
            <input id="todo-ship-date" name="ship_date" type="date" defaultValue={initial?.shipDate ?? ""} className="erp-input" />
          </div>
        )}
      </div>

      <div className="erp-detail erp-u-mt-0">
        <div className="erp-detail-tabs erp-u-justify-between erp-u-relative">
          <span className="erp-detail-tab active">품목</span>
          <div className="erp-u-flex erp-u-items-center erp-u-gap-4 erp-u-wrap erp-u-m-4">
            <QuickAddProductSearch products={products} onAdd={quickAddProduct} />
            <button type="button" onClick={() => openImport("purchase")} className="erp-btn erp-u-minw-0">
              매입에서 불러오기
            </button>
            <button type="button" onClick={() => openImport("sale")} className="erp-btn erp-u-minw-0">
              매출에서 불러오기
            </button>
            <button type="button" onClick={addRow} className="erp-btn erp-u-minw-0">
              + 품목 추가
            </button>
            <TodoPaperCalcToolbarButton pc={pc} enabled={paperCalcEnabled} />
          </div>
          {importKind && (
            <OrderImportPopover
              kind={importKind}
              date={importDate}
              onDateChange={(d) => {
                setImportDate(d);
                void loadImportOrders(importKind, d);
              }}
              orders={importOrders}
              loading={importLoading}
              failed={importFailed}
              onImport={applyImport}
              onClose={() => setImportKind(null)}
            />
          )}
        </div>
        {importMessage && <p className="erp-u-muted erp-u-text-caption erp-u-pad-6-10" role="status">{importMessage}</p>}

        <TodoPaperCalcBanner pc={pc} />

        <div className="hidden md:block">
        <div className="erp-grid-wrap erp-u-border-none erp-u-radius-0">
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
                          className="mt-1 flex items-center gap-1 text-[10.5px] erp-u-muted"
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
                        onChange={(e) => updateRow(row.key, { lotNumber: normalizeLotNumber(e.target.value) })}
                        className="erp-input w-full"
                      />
                    </td>
                    <td className="erp-u-muted">{product?.unit ?? "-"}</td>
                    <td className="num">
                      <QuantityWithBoxInput
                        quantity={row.quantity}
                        onQuantityChange={(n) => updateRow(row.key, { quantity: n })}
                        basePackageQty={product?.base_package_qty}
                        unit={product?.unit}
                        allowFormula
                        className="erp-input w-full"
                      />
                    </td>
                    <td className="num erp-u-muted">
                      {(() => {
                        const unitPrice = todoType === "sale" ? product?.price : product?.cost;
                        if (!product || !unitPrice || row.quantity <= 0) return "-";
                        return `${formatNumber((unitPrice * row.quantity))}원`;
                      })()}
                    </td>
                    <td className="num">
                      <button
                        type="button"
                        className="erp-btn erp-btn-danger erp-btn-sm erp-u-minw-0"
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

        {/* 모바일(768px 미만)은 가로로 긴 표 대신 카드 목록 — 견적서·구매요청서 등과 같은 공용 패널을 쓴다. 행 상태는 데스크톱 표와 같다. */}
        <div className="md:hidden erp-u-pad-6-10">
          <MobileItemEntryPanel
            products={products}
            items={rows
              .filter((r) => r.productId)
              .map((r) => {
                const p = products.find((x) => x.id === r.productId);
                return { key: r.key, name: p?.name ?? "", spec: r.spec, quantity: r.quantity, lotNumber: r.lotNumber };
              })}
            showPrice={false}
            showLot
            onAdd={(productId, quantity, _price, lotNumber) => {
              const product = products.find((p) => p.id === productId);
              const newRow: Row = { key: nextKey, productId, spec: product?.spec ?? "", manualSpec: false, lotNumber: lotNumber ?? "", quantity };
              setRows((prev) => (prev.length === 1 && !prev[0].productId && prev[0].quantity === 0 ? [newRow] : [...prev, newRow]));
              setNextKey((k) => k + 1);
            }}
            onUpdateQuantity={(key, quantity) => updateRow(key, { quantity })}
            onUpdateLot={(key, lotNumber) => updateRow(key, { lotNumber })}
            onRemove={removeRow}
          />
        </div>
      </div>

      <div>
        <label htmlFor="todo-memo" className="mb-1 block text-xs erp-u-muted">
          메모 (품목과 무관한 참고 메모)
        </label>
        <textarea
          id="todo-memo"
          name="memo"
          placeholder="메모"
          rows={4}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="erp-input erp-textarea-compact w-full"
        />
      </div>

      <div className="erp-form-actions">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary erp-form-submit">
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
