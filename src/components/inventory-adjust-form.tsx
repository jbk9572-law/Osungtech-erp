"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { adjustInventory } from "@/app/(dashboard)/inventory/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { ModalFormSheet } from "@/components/erp/modal-form-sheet";
import { QuantityWithBoxInput } from "@/components/quantity-with-box-input";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { formatNumber } from "@/lib/format-number";
import { PageGuide } from "@/components/erp/page-guide";
import { ErpSelect } from "@/components/erp/erp-select";

type Product = {
  id: string;
  sku: string;
  name: string;
  spec?: string | null;
  unit?: string | null;
  base_package_qty?: number | null;
};
type StockLevel = { product_id: string; warehouse_id: string; quantity: number };

export function InventoryAdjustForm({
  products,
  warehouseId: defaultWarehouseId,
  warehouses = [],
  stockLevels,
}: {
  products: Product[];
  warehouseId: string;
  // 창고가 2개 이상이면 아래에 창고 선택 드롭다운이 뜨고, 1개면(대부분의
  // 기존 테넌트) 예전처럼 이 기본값 그대로 조용히 쓰인다.
  warehouses?: { id: string; name: string }[];
  stockLevels: StockLevel[];
}) {
  const [state, formAction, pending] = useActionState(adjustInventory, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useKeyShortcut("F7", submitRef);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState<"increase" | "decrease">("increase");
  const [amount, setAmount] = useState(0);
  // "용도"를 고르면 사유(note)에 자동으로 꼬리표를 붙인다 — 재고실사의
  // "재고실사: ..." 접두사와 같은 방식으로, 입출고내역에서 이 조정이 왜
  // 생겼는지 한눈에 구분할 수 있게 한다. "샘플 증정(무상)"/"자연로스"를
  // 고르면 재고가 줄어드는 경우만 말이 되므로 방향을 차감으로 고정한다.
  // "자연로스(공정손실)"는 일반 조정과 달리 FIFO 매입 레이어도 실제로
  // 소진해야 해서(actions.ts의 is_natural_loss 분기 참고) 서버에 별도
  // 플래그로 알려준다.
  const [reason, setReason] = useState<"" | "sample" | "natural_loss">("");
  const [noteText, setNoteText] = useState("");

  // 저장에 성공해도 예전엔 방금 고른 상품/수량이 폼에 그대로 남아있어서,
  // 다음 조정을 하려면 매번 직접 지워야 했고 깜빡하면 같은 조정이 중복
  // 등록될 위험도 있었다. 성공 시 폼을 초기 상태로 되돌린다.
  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local UI state in reaction to a server action result, not derived state
      setProductId("");
      setDirection("increase");
      setAmount(0);
      setReason("");
      setNoteText("");
      formRef.current?.reset();
    }
  }, [state]);

  // 자연로스는 record_natural_loss RPC가 서버에서 "자연로스: " 접두사를
  // 이미 붙이므로(migration 00000000000206) 여기서는 원문 그대로 보낸다.
  const finalNote = reason === "sample" ? `[샘플증정] ${noteText}`.trim() : noteText;

  const currentStock = useMemo(() => {
    if (!productId) return null;
    const row = stockLevels.find(
      (s) => s.product_id === productId && s.warehouse_id === warehouseId
    );
    return row?.quantity ?? 0;
  }, [productId, warehouseId, stockLevels]);

  const signedQuantity = direction === "decrease" ? -amount : amount;
  const projectedStock = (currentStock ?? 0) + signedQuantity;
  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <ModalFormSheet
      title="재고 조정"
      tabLabel="재고 조정 (기초재고 등록 등)"
      formRef={formRef}
      formAction={formAction}
      state={state}
      pending={pending}
      submitRef={submitRef}
      submitLabel="F7 저장"
    >
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="quantity" value={signedQuantity} />
      <input type="hidden" name="is_natural_loss" value={reason === "natural_loss" ? "1" : ""} />
      <input type="hidden" name="note" value={finalNote} />
      {warehouses.length <= 1 ? (
        <input type="hidden" name="warehouse_id" value={warehouseId} />
      ) : (
        <div className="erp-field erp-span-4">
          <label htmlFor="adj-warehouse">창고</label>
          <ErpSelect
            id="adj-warehouse"
            name="warehouse_id"
            value={warehouseId}
            onChange={setWarehouseId}
            required
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          />
        </div>
      )}
      <div className={`erp-field ${warehouses.length <= 1 ? "erp-span-12" : "erp-span-8"}`}>
        <label htmlFor="adj-product">품목</label>
        <ProductSearchSelect id="adj-product" products={products} value={productId} onChange={setProductId} />
      </div>
      <div className="erp-field erp-span-4">
        <label>방향</label>
        <div className="erp-seg">
          <button type="button" className={direction === "increase" ? "active" : ""} onClick={() => setDirection("increase")} disabled={reason === "sample" || reason === "natural_loss"}>
            증가
          </button>
          <button type="button" className={direction === "decrease" ? "active" : ""} onClick={() => setDirection("decrease")} disabled={reason === "sample" || reason === "natural_loss"}>
            차감
          </button>
        </div>
      </div>
      <div className="erp-field erp-span-4">
        <label htmlFor="adj-qty">수량</label>
        <QuantityWithBoxInput
          id="adj-qty"
          quantity={amount}
          onQuantityChange={setAmount}
          basePackageQty={selectedProduct?.base_package_qty}
          unit={selectedProduct?.unit}
          allowFormula
          className="erp-input"
        />
      </div>
      <div className="erp-field erp-span-4">
        <label htmlFor="adj-reason">용도</label>
        <ErpSelect
          id="adj-reason"
          value={reason}
          onChange={(v) => {
            const next = v as "" | "sample" | "natural_loss";
            setReason(next);
            if (next === "sample" || next === "natural_loss") setDirection("decrease");
          }}
          options={[
            { value: "", label: "직접 입력" },
            { value: "sample", label: "샘플 증정(무상)" },
            { value: "natural_loss", label: "자연로스(공정손실/환산단위 오차)" },
          ]}
        />
      </div>
      <div className="erp-field erp-span-12">
        <label htmlFor="adj-note">사유</label>
        <input
          id="adj-note"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          autoComplete="off"
          placeholder={
            reason === "sample"
              ? "샘플 제공 사유 (예: OO업체 영업용 샘플 3박스)"
              : reason === "natural_loss"
                ? "손실 사유 (예: 재단 중 파손 3개, 환산단위 오차 2개)"
                : "사유 (예: 기초재고, 실사 조정)"
          }
          className="erp-input erp-u-w-full"
        />
      </div>
      {currentStock !== null && (
        <div className="erp-field erp-span-12">
          <p className="erp-u-text-xs" style={{ color: projectedStock < 0 ? "var(--erp-danger)" : "var(--erp-text-muted)" }}>
            현재 재고: {formatNumber(currentStock)}개 → 조정 후: {formatNumber(projectedStock)}개
            {projectedStock < 0 && " (재고 부족)"}
          </p>
          {/* 재고가 0 밑으로 내려가는 차감은 DB가 거절한다(migration 266, 회사 설정으로만 예외) — 미리 알려 준다. */}
          {projectedStock < 0 && <PageGuide tone="warning">⚠ 조정 후 재고가 음수가 되어 등록할 수 없습니다. 차감 수량을 줄여주세요.</PageGuide>}
        </div>
      )}
    </ModalFormSheet>
  );
}
