"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createPurchase } from "@/app/(dashboard)/purchases/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { FormMessage } from "@/components/form-message";
import type { FormState } from "@/components/form-message";
import { NumberInput } from "@/components/number-input";
import { QuantityWithBoxInput } from "@/components/quantity-with-box-input";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { focusSameColumnNextRow } from "@/lib/grid-enter-nav";
import { PaperCalcModalTrigger } from "@/components/paper-calc/paper-calc-modal-trigger";
import type { PendingCalcPayload } from "@/components/paper-calc/paper-calc-client";
import { PENDING_PAPER_CALC_PURCHASE_KEY } from "@/lib/paper-calc-pending-key";
import {
  formatPaperCalcSizeLines,
  mergePaperCalcInputItems,
  type PaperCalcSizeRow,
} from "@/lib/paper-calc-summary";

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

  // 신규 등록일 때만 의미가 있다: 수정 화면은 이미 purchase_order_id가 있어서
  // 모조지 계산 화면에서 바로 저장하면 되고, 여기서 또 붙일 필요가 없다.
  // 이 값을 채우는 경로는 두 가지다.
  // 1) 이 폼 안의 모달(PaperCalcModalTrigger)에서 "이 계산 적용하기"를
  //    누르면 onApply 콜백으로 바로 이 state에 꽂힌다.
  // 2) 트리메뉴/탭바를 통해 독립적으로 연 "확장모듈 > 모조지 계산"
  //    화면에서 미리 테스트 계산을 해보고 "새 매입 등록에 연결"을 누른
  //    경우 — 그 화면은 이 폼과 다른 페이지라 직접 콜백을 넘길 수 없어,
  //    localStorage에 잠깐 담아뒀다가 이 폼이 마운트될 때(혹은 이미 열려
  //    있는 다른 탭에서 나중에 저장했을 때 storage 이벤트로) 읽어온다.
  const [pendingPaperCalc, setPendingPaperCalc] = useState<string | null>(null);
  function handlePaperCalcApply(payload: PendingCalcPayload) {
    setPendingPaperCalc(JSON.stringify(payload));
  }

  useEffect(() => {
    if (initial?.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount
    setPendingPaperCalc(localStorage.getItem(PENDING_PAPER_CALC_PURCHASE_KEY));

    function handleStorage(e: StorageEvent) {
      if (e.key === PENDING_PAPER_CALC_PURCHASE_KEY) {
        setPendingPaperCalc(e.newValue);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [initial?.id]);

  // 임시 저장된 모조지 계산이 있으면 등록 버튼을 누르기 전에도 TG0 품목
  // 줄이 실제로 어떤 수량으로 들어갈지 그리드에 미리 보여준다. 이 줄은
  // 편집 가능한 rows에는 넣지 않는다 — 실제 저장은 createPurchase가 주문
  // 생성 직후 attachPendingPaperCalculationToPurchase로 처리한다.
  const pendingCalcSummary = useMemo(() => {
    if (!pendingPaperCalc) return null;
    try {
      const parsed = JSON.parse(pendingPaperCalc) as { totalSheet: number; totalPaper: number };
      return { totalSheet: parsed.totalSheet, totalPaper: parsed.totalPaper };
    } catch {
      return null;
    }
  }, [pendingPaperCalc]);
  const tg0Product = useMemo(() => products.find((p) => p.sku === "TG0"), [products]);
  const pendingCalcUnitCost = tg0Product ? Number(tg0Product.cost) : 0;
  // 거래처와 협의해 자동 계산값(예: 3.2연)과 다른 수량(예: 3연)으로 등록해야
  // 하는 경우, 등록 시점에 바로 고칠 수 있게 한다 — null이면 자동값 그대로.
  // 저장 시(createPurchase)에는 이 값이 있을 때만 오버라이드 이력을 남긴다.
  const [tg0OverrideQuantity, setTg0OverrideQuantity] = useState<number | null>(null);
  const pendingCalcQuantity = pendingCalcSummary
    ? (tg0OverrideQuantity ?? pendingCalcSummary.totalSheet)
    : 0;
  const pendingCalcAmount = pendingCalcQuantity * pendingCalcUnitCost;
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
    if (!pendingPaperCalc) return [];
    let sizes: PaperCalcSizeRow[] = [];
    try {
      const parsed = JSON.parse(pendingPaperCalc) as { inputItems?: unknown };
      sizes = mergePaperCalcInputItems(sizes, parsed.inputItems);
    } catch {
      // 무시
    }
    return formatPaperCalcSizeLines(sizes);
  }, [pendingPaperCalc]);

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
      onSubmit={() => {
        setMessageDismissed(false);
        // 제출 시점에 임시 계산을 같이 넘기고 나면 더 이상 필요 없으니
        // 지운다(모달 콜백으로 들어온 값은 애초에 localStorage에 쓴 적이
        // 없어 지울 것도 없다). 등록이 실패해도 계산 자체는 다시 하면
        // 되므로 감수할 만한 트레이드오프다.
        if (pendingPaperCalc) localStorage.removeItem(PENDING_PAPER_CALC_PURCHASE_KEY);
      }}
    >
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="warehouse_id" value={warehouseId} />
      <input type="hidden" name="items" value={itemsJson} />
      {pendingPaperCalc && <input type="hidden" name="pendingPaperCalc" value={pendingPaperCalc} />}
      {tg0IsOverridden && (
        <input type="hidden" name="tg0OverrideQuantity" value={tg0OverrideQuantity ?? ""} />
      )}

      {pendingPaperCalc && (
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
          <div style={{ display: "flex", alignItems: "center", gap: 4, margin: 4 }}>
            <button type="button" onClick={addRow} className="erp-btn" style={{ minWidth: 0 }}>
              + 품목 추가
            </button>
            {!initial?.id && (
              <PaperCalcModalTrigger pendingFor="purchase" onApply={handlePaperCalcApply} />
            )}
          </div>
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
                  <td className="num">{pendingCalcUnitCost.toLocaleString()}</td>
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
                        localStorage.removeItem(PENDING_PAPER_CALC_PURCHASE_KEY);
                        setPendingPaperCalc(null);
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
