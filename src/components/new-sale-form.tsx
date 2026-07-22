"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  createSale,
  getPaperCalculationsForPurchaseOrder,
  getPurchaseItemsForDate,
  type TodayPurchaseItem,
} from "@/app/(dashboard)/sales/actions";
import type { PendingCalc } from "@/lib/paper-calc-sync";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";
import type { FormState } from "@/components/form-message";
import { PriceHistoryHint } from "@/components/price-history-hint";
import { NumberInput } from "@/components/number-input";
import { QuantityWithBoxInput } from "@/components/quantity-with-box-input";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { focusSameColumnNextRow } from "@/lib/grid-enter-nav";
import { PaperCalcModalTrigger } from "@/components/paper-calc/paper-calc-modal-trigger";
import type { PendingCalcPayload } from "@/components/paper-calc/paper-calc-client";
import { PENDING_PAPER_CALC_KEY } from "@/lib/paper-calc-pending-key";
import {
  formatPaperCalcSizeLines,
  mergePaperCalcInputItems,
  type PaperCalcSizeRow,
} from "@/lib/paper-calc-summary";

type Customer = { id: string; name: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  spec?: string | null;
  unit?: string | null;
  price: number;
  stock?: number;
  base_package_qty?: number | null;
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
  remark: string;
};

export type SaleInitial = {
  id: string;
  customerId: string;
  warehouseId: string;
  orderDate: string;
  memo: string;
  items: {
    productId: string;
    spec?: string | null;
    quantity: number;
    unitPrice: number;
    remark?: string | null;
  }[];
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
          remark: item.remark ?? "",
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

  // 신규 등록일 때만 의미가 있다: 수정 화면은 이미 sales_order_id가 있어서
  // 모조지 계산 화면에서 바로 저장하면 되고, 여기서 또 붙일 필요가 없다.
  // 이 값을 채우는 경로는 두 가지다.
  // 1) 이 폼 안의 모달(PaperCalcModalTrigger)에서 "이 계산 적용하기"를
  //    누르면 onApply 콜백으로 바로 이 state에 꽂힌다.
  // 2) 트리메뉴/탭바를 통해 독립적으로 연 "확장모듈 > 모조지 계산"
  //    화면에서 미리 테스트 계산을 해보고 "새 판매 등록에 연결"을 누른
  //    경우 — 그 화면은 이 폼과 다른 페이지라 직접 콜백을 넘길 수 없어,
  //    localStorage에 잠깐 담아뒀다가 이 폼이 마운트될 때(혹은 이미 열려
  //    있는 다른 탭에서 나중에 저장했을 때 storage 이벤트로) 읽어온다.
  const [pendingPaperCalc, setPendingPaperCalc] = useState<string | null>(null);
  function handlePaperCalcApply(payload: PendingCalcPayload) {
    setPendingPaperCalc(JSON.stringify(payload));
  }

  useEffect(() => {
    if (initial?.id) return;
    setPendingPaperCalc(localStorage.getItem(PENDING_PAPER_CALC_KEY));

    function handleStorage(e: StorageEvent) {
      if (e.key === PENDING_PAPER_CALC_KEY) {
        setPendingPaperCalc(e.newValue);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [initial?.id]);

  // 당일 입고된 품목을 그대로 매출로 옮겨 담는 기능(모조지처럼 당일 입고 후
  // 바로 당일 출고되는 품목을 이중 입력하지 않게 하려는 용도). 거래일자와
  // 별도로 조회할 날짜를 고를 수 있게 한다 — 매출 등록일과 실제 입고일이
  // 다른 경우(예: 어제 입고분을 오늘 매출로 처리)도 있기 때문.
  const [purchaseLookupDate, setPurchaseLookupDate] = useState(orderDate);
  const [purchaseCandidates, setPurchaseCandidates] = useState<TodayPurchaseItem[] | null>(null);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [addedPurchaseItemIds, setAddedPurchaseItemIds] = useState<Set<string>>(new Set());
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  // 모조지(TG0) 입고 품목은 수량만 옮기면 사이즈별 배치 내역이 사라지므로,
  // 그 매입 건에 연결된 모조지 계산 자체를 통째로 복사해서 등록 시 같이 붙인다.
  const [copiedPaperCalcs, setCopiedPaperCalcs] = useState<PendingCalc[]>([]);

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
    if (item.sku === "TG0") {
      setAddingItemId(item.id);
      try {
        const calcs = await getPaperCalculationsForPurchaseOrder(item.purchaseOrderId);
        if (calcs.length > 0) {
          setCopiedPaperCalcs((prev) => [...prev, ...calcs]);
          setAddedPurchaseItemIds((prev) => new Set(prev).add(item.id));
          return;
        }
      } finally {
        setAddingItemId(null);
      }
    }

    const newRow: Row = {
      key: nextKey,
      productId: item.productId,
      spec: item.spec,
      manualSpec: Boolean(item.spec),
      quantity: item.quantity,
      unitPrice: resolvePrice(customerId, item.productId),
      manualPrice: false,
      remark: "",
    };
    setRows((prev) =>
      prev.length === 1 && !prev[0].productId && prev[0].quantity === 0 ? [newRow] : [...prev, newRow]
    );
    setNextKey((k) => k + 1);
    setAddedPurchaseItemIds((prev) => new Set(prev).add(item.id));
  }

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const price of prices) {
      map.set(`${price.customer_id}:${price.product_id}`, Number(price.unit_price));
    }
    return map;
  }, [prices]);

  // 수정 화면에서는 product.stock이 "이 거래로 이미 출고 처리된 뒤"의 현재
  // 재고라, 원래 수량 그대로 비교하면 항상 부족한 것처럼 보인다. 이 거래가
  // 원래 갖고 있던 수량만큼은 되돌려받은 셈 치고 비교해야 한다.
  const originalQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of initial?.items ?? []) {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
    return map;
  }, [initial]);

  function resolvePrice(forCustomerId: string, productId: string) {
    const fromCustomer = priceMap.get(`${forCustomerId}:${productId}`);
    if (fromCustomer !== undefined) return fromCustomer;
    const product = products.find((p) => p.id === productId);
    return product ? Number(product.price) : 0;
  }

  // 임시 저장된 모조지 계산 + 입고 불러오기로 복사해온 계산들을 합쳐서,
  // 등록 버튼을 누르기 전에도 TG0 품목 줄이 실제로 어떤 수량으로 들어갈지
  // 그리드에 미리 보여준다. 이 줄은 편집 가능한 rows에는 넣지 않는다 —
  // 실제 저장은 createSale이 주문 생성 직후 attachPendingPaperCalculation/
  // attachCopiedPaperCalculations으로 처리하고(재고는 건드리지 않음), 여기서
  // rows에 섞으면 일반 품목과 똑같이 재고가 차감돼버린다.
  const pendingCalcSummary = useMemo(() => {
    let totalSheet = 0;
    let totalPaper = 0;
    if (pendingPaperCalc) {
      try {
        const parsed = JSON.parse(pendingPaperCalc) as { totalSheet: number; totalPaper: number };
        totalSheet += parsed.totalSheet;
        totalPaper += parsed.totalPaper;
      } catch {
        // 무시: 잘못된 값이면 이 부분은 0으로 취급
      }
    }
    for (const calc of copiedPaperCalcs) {
      totalSheet += calc.totalSheet;
      totalPaper += calc.totalPaper;
    }
    return totalSheet > 0 ? { totalSheet, totalPaper } : null;
  }, [pendingPaperCalc, copiedPaperCalcs]);
  const tg0Product = useMemo(() => products.find((p) => p.sku === "TG0"), [products]);
  const pendingCalcUnitPrice = tg0Product ? resolvePrice(customerId, tg0Product.id) : 0;
  // 거래처와 협의해 자동 계산값(예: 3.2연)과 다른 수량(예: 3연)으로 등록해야
  // 하는 경우, 등록 시점에 바로 고칠 수 있게 한다 — null이면 자동값 그대로.
  // 저장 시(createSale)에는 이 값이 있을 때만 오버라이드 이력을 남긴다.
  const [tg0OverrideQuantity, setTg0OverrideQuantity] = useState<number | null>(null);
  const pendingCalcQuantity = pendingCalcSummary
    ? (tg0OverrideQuantity ?? pendingCalcSummary.totalSheet)
    : 0;
  const pendingCalcAmount = pendingCalcQuantity * pendingCalcUnitPrice;
  const tg0IsOverridden =
    pendingCalcSummary !== null &&
    tg0OverrideQuantity !== null &&
    tg0OverrideQuantity !== pendingCalcSummary.totalSheet;

  // TG0(모조지) 한 줄은 연 단위 수량/금액만 보여주지만, 실제로 어떤
  // 사이즈를 몇 장씩 조합해서 그 연수가 나왔는지는 메모 한 줄에 다 담기
  // 어렵다 — 그래서 계산에 들어간 사이즈별 수량을 품목 표 아래에 참고용
  // 줄로 그대로 보여준다. 이 줄들은 수량/단가를 세지 않는다(원지
  // 자체는 연 단위로만 청구하고, 여기 사이즈들은 그 원지를 조합해서
  // 만드는 최종 상품일 뿐 별도로 판매/청구되는 게 아니기 때문).
  const paperCalcSizeLines = useMemo(() => {
    let sizes: PaperCalcSizeRow[] = [];
    if (pendingPaperCalc) {
      try {
        const parsed = JSON.parse(pendingPaperCalc) as { inputItems?: unknown };
        sizes = mergePaperCalcInputItems(sizes, parsed.inputItems);
      } catch {
        // 무시
      }
    }
    for (const calc of copiedPaperCalcs) {
      sizes = mergePaperCalcInputItems(sizes, calc.inputItems);
    }
    return formatPaperCalcSizeLines(sizes);
  }, [pendingPaperCalc, copiedPaperCalcs]);

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
        remark: "",
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

  const supplyAmount = rows.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0) + pendingCalcAmount;
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
      onSubmit={() => {
        setMessageDismissed(false);
        // 제출 시점에 임시 계산을 같이 넘기고 나면 더 이상 필요 없으니
        // 지운다(모달 콜백으로 들어온 값은 애초에 localStorage에 쓴 적이
        // 없어 지울 것도 없다). 등록이 실패해도 계산 자체는 다시 하면
        // 되므로 감수할 만한 트레이드오프다.
        if (pendingPaperCalc) localStorage.removeItem(PENDING_PAPER_CALC_KEY);
      }}
    >
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="warehouse_id" value={warehouseId} />
      <input type="hidden" name="items" value={itemsJson} />
      {pendingPaperCalc && <input type="hidden" name="pendingPaperCalc" value={pendingPaperCalc} />}
      {copiedPaperCalcs.length > 0 && (
        <input type="hidden" name="copiedPaperCalcs" value={JSON.stringify(copiedPaperCalcs)} />
      )}
      {tg0IsOverridden && (
        <input type="hidden" name="tg0OverrideQuantity" value={tg0OverrideQuantity ?? ""} />
      )}

      {(pendingPaperCalc || copiedPaperCalcs.length > 0) && (
        <div
          className="rounded p-2 text-xs"
          style={{ background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe" }}
        >
          모조지 계산 결과가 이 주문에 연결되어 있습니다 — 아래 품목 목록에 TG0 자동 반영
          줄로 표시됩니다. 등록하면 실제로 저장됩니다.
        </div>
      )}

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
        <div className="erp-detail-tabs" style={{ justifyContent: "space-between", position: "relative" }}>
          <span className="erp-detail-tab active">품목</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, margin: 4 }}>
            <input
              type="date"
              value={purchaseLookupDate}
              onChange={(e) => setPurchaseLookupDate(e.target.value)}
              className="erp-input"
              style={{ width: 130 }}
            />
            <button
              type="button"
              onClick={loadPurchasesForDate}
              className="erp-btn"
              style={{ minWidth: 0 }}
              disabled={loadingPurchases}
            >
              {loadingPurchases ? "불러오는 중..." : "입고 불러오기"}
            </button>
            <button type="button" onClick={addRow} className="erp-btn" style={{ minWidth: 0 }}>
              + 품목 추가
            </button>
            {!initial?.id && (
              <PaperCalcModalTrigger pendingFor="sales" onApply={handlePaperCalcApply} />
            )}
          </div>

          {purchaseCandidates !== null && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 4,
                zIndex: 20,
                width: 420,
                maxWidth: "90vw",
                maxHeight: 320,
                overflowY: "auto",
                background: "#fff",
                border: "1px solid var(--erp-border)",
                borderRadius: 2,
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderBottom: "1px solid var(--erp-border)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span>{purchaseLookupDate} 입고 품목</span>
                <button
                  type="button"
                  onClick={() => setPurchaseCandidates(null)}
                  className="erp-btn erp-btn-danger"
                  style={{ minWidth: 0, height: 22, padding: "0 8px" }}
                >
                  닫기
                </button>
              </div>
              {purchaseCandidates.length === 0 ? (
                <p className="erp-home-empty" style={{ padding: 10 }}>
                  해당 날짜에 입고된 품목이 없습니다.
                </p>
              ) : (
                purchaseCandidates.map((item) => {
                  const added = addedPurchaseItemIds.has(item.id);
                  const isAdding = addingItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "6px 10px",
                        borderBottom: "1px solid #f0f1f3",
                        fontSize: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{item.productName}</div>
                        <div style={{ color: "var(--erp-text-muted)", fontSize: 11 }}>
                          {item.supplierName} · {item.spec || "규격 미지정"} :{" "}
                          {item.quantity.toLocaleString()}
                          {item.unit}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addPurchaseItem(item)}
                        className="erp-btn"
                        style={{ minWidth: 0, height: 24, padding: "0 8px", flexShrink: 0 }}
                        disabled={added || isAdding}
                      >
                        {added ? "추가됨" : isAdding ? "추가 중..." : "추가"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="erp-grid-wrap" style={{ border: "none", borderRadius: 0, minHeight: "50vh" }}>
          <table className="erp-grid" style={{ tableLayout: "fixed", width: "100%", minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: "20%" }}>품목</th>
                <th style={{ width: "10%" }}>규격</th>
                <th style={{ width: "6%" }}>단위</th>
                <th className="num" style={{ width: "16%" }}>
                  수량
                </th>
                <th className="num" style={{ width: "15%" }}>
                  단가
                </th>
                <th className="num" style={{ width: "15%" }}>
                  금액
                </th>
                <th style={{ width: "12%" }}>비고</th>
                <th style={{ width: "6%" }} />
              </tr>
            </thead>
            <tbody onKeyDown={focusSameColumnNextRow}>
              {pendingCalcSummary && (
                <tr style={{ background: "#eef2ff" }}>
                  <td>
                    {tg0Product ? (
                      <>
                        {tg0Product.name}
                        <span
                          className="ml-1 rounded px-1 text-[10.5px]"
                          style={{ background: "#c7d2fe", color: "#3730a3" }}
                        >
                          자동
                        </span>
                      </>
                    ) : (
                      <span style={{ color: "#dc3545" }}>
                        SKU &apos;TG0&apos; 품목이 없어 자동 반영되지 않습니다
                      </span>
                    )}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{tg0Product?.unit ?? "-"}</td>
                  <td className="num">
                    <NumberInput
                      value={pendingCalcQuantity}
                      onChange={setTg0OverrideQuantity}
                      className="erp-input w-full"
                    />
                  </td>
                  <td className="num">{pendingCalcUnitPrice.toLocaleString()}</td>
                  <td className="num">{pendingCalcAmount.toLocaleString()}원</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {tg0IsOverridden
                      ? `자동값 ${pendingCalcSummary.totalSheet.toLocaleString()} → 수동 입력`
                      : "모조지 계산 자동 반영"}
                  </td>
                  <td className="num">
                    <button
                      type="button"
                      className="erp-btn erp-btn-danger"
                      style={{ minWidth: 0, height: 26, padding: "0 8px" }}
                      onClick={() => {
                        localStorage.removeItem(PENDING_PAPER_CALC_KEY);
                        setPendingPaperCalc(null);
                        setCopiedPaperCalcs([]);
                        setTg0OverrideQuantity(null);
                      }}
                    >
                      취소
                    </button>
                  </td>
                </tr>
              )}
              {paperCalcSizeLines.map((line, i) => (
                <tr key={`paper-calc-size-${i}`} style={{ background: "#f7f8fb" }}>
                  <td colSpan={2} style={{ color: "var(--erp-text-muted)", paddingLeft: 24 }}>
                    ㄴ {line}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    -
                  </td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    -
                  </td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    -
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td />
                </tr>
              ))}
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
                      {row.productId && product && (() => {
                        const availableStock =
                          (product.stock ?? 0) + (originalQtyByProduct.get(row.productId) ?? 0);
                        const short = row.quantity > availableStock;
                        return (
                          <p
                            className="text-[10.5px]"
                            style={{ color: short ? "#dc3545" : "var(--erp-text-muted)" }}
                          >
                            재고 {(product.stock ?? 0).toLocaleString()}{product.unit ?? ""}
                            {short && " · 부족"}
                          </p>
                        );
                      })()}
                    </td>
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
                  합계
                </td>
                <td className="num" colSpan={3}>
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
