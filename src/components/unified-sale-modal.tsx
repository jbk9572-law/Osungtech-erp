"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { PartySearchSelect } from "@/components/party-search-select";
import { ProductSearchSelect } from "@/components/product-search-select";
import { PartyPaymentForm } from "@/components/party-payment-form";
import { FormMessage } from "@/components/form-message";
import { PageGuide } from "@/components/erp/page-guide";
import { ErpSelect } from "@/components/erp/erp-select";
import { createSale } from "@/app/(dashboard)/sales/actions";
import { addCustomerPayment } from "@/app/(dashboard)/customers/actions";
import { RETURN_REASONS } from "@/lib/return-reason";
import { TAX_TYPES } from "@/lib/tax-evidence-type";
import { formatNumber } from "@/lib/format-number";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";

type Customer = { id: string; name: string; notes?: string | null };
type Product = { id: string; sku: string; name: string; spec?: string | null };
type Warehouse = { id: string; name: string };
type Tab = "sale" | "payment" | "return";

const TABS: { key: Tab; label: string }[] = [
  { key: "sale", label: "매출" },
  { key: "payment", label: "수금" },
  { key: "return", label: "반품" },
];

// 사용자가 올린 "통합 판매 거래 등록" 목업 — 매출관리 메뉴 어디서든
// 이 버튼 하나로 매출/수금/반품을 모달 안에서 탭만 바꿔가며 연달아
// 처리한다(출고처관리/매출/수금 화면을 각각 새로 열고 닫을 필요 없이).
// 실제 등록 로직은 전부 기존 서버 액션(createSale/addCustomerPayment)을
// 그대로 호출한다 — 이 모달은 새 비즈니스 로직이 아니라 새 입구일 뿐이다.
// /sales/new의 정식 등록 폼(품목 수십 줄·모조지 계산·임시저장 등)은
// 그대로 두고, 이 모달은 "거래처 고르고 품목 1~5줄만 빠르게" 쓰는
// 용도로 범위를 좁혔다.
export function UnifiedSaleModalTrigger({
  customers,
  products,
  warehouses,
  today,
}: {
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  useEscapeToClose(open, () => setOpen(false));

  return (
    <>
      <button type="button" className="erp-btn" onClick={() => setOpen(true)}>
        ⚡ 빠른등록(매출·수금·반품)
      </button>
      {open && (
        <UnifiedSaleModal
          customers={customers}
          products={products}
          warehouses={warehouses}
          today={today}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function UnifiedSaleModal({
  customers,
  products,
  warehouses,
  today,
  onClose,
}: {
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  today: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("sale");
  const [paymentCustomerId, setPaymentCustomerId] = useState("");

  return (
    <div className="erp-modal-overlay" onClick={onClose}>
      <div className="erp-modal erp-modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="erp-modal-title">
          통합 판매 거래 등록
          <button type="button" className="erp-modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="erp-modal-body">
          <div className="erp-unified-sale-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`erp-unified-sale-tab${tab === t.key ? " active" : ""}${t.key === "return" ? " danger" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "sale" && (
            <SaleQuickForm
              isReturn={false}
              customers={customers}
              products={products}
              warehouses={warehouses}
              today={today}
              onDone={onClose}
            />
          )}

          {tab === "return" && (
            <SaleQuickForm
              isReturn
              customers={customers}
              products={products}
              warehouses={warehouses}
              today={today}
              onDone={onClose}
            />
          )}

          {tab === "payment" && (
            <div className="erp-field" style={{ marginBottom: 12 }}>
              <label htmlFor="unified-payment-customer">거래처 *</label>
              <PartySearchSelect
                id="unified-payment-customer"
                parties={customers}
                value={paymentCustomerId}
                onChange={setPaymentCustomerId}
                placeholder="거래처명 검색"
              />
              {paymentCustomerId ? (
                <div style={{ marginTop: 10 }}>
                  <PartyPaymentForm
                    action={addCustomerPayment}
                    partyIdField="customer_id"
                    partyId={paymentCustomerId}
                    today={today}
                    label="수금"
                  />
                </div>
              ) : (
                <p className="erp-grid-empty" style={{ marginTop: 10 }}>
                  거래처를 먼저 선택해주세요.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ItemRow = { key: number; productId: string; quantity: string; unitPrice: string };

function emptyRow(key: number): ItemRow {
  return { key, productId: "", quantity: "1", unitPrice: "" };
}

// 매출/반품 두 탭이 "is_return 플래그와 사유 입력칸 유무"만 다르고 나머지
// 필드는 완전히 같아서 하나로 합쳤다 — new-sale-form.tsx의 풀 버전처럼
// 모조지 계산/임시저장/위치별재고 같은 건 없고, 거래처+품목 몇 줄만
// 빠르게 넣는 용도다.
function SaleQuickForm({
  isReturn,
  customers,
  products,
  warehouses,
  today,
  onDone,
}: {
  isReturn: boolean;
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  today: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createSale, undefined);
  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [returnReason, setReturnReason] = useState<string>(RETURN_REASONS[0]);
  const [taxType, setTaxType] = useState<string>("과세");
  const [rows, setRows] = useState<ItemRow[]>([emptyRow(0)]);
  const [nextKey, setNextKey] = useState(1);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const lastHandledState = useRef(state);
  useEffect(() => {
    if (state !== lastHandledState.current) {
      lastHandledState.current = state;
      if (state?.redirectTo) {
        router.refresh();
        onDone();
      }
    }
  }, [state, router, onDone]);

  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow(nextKey)]);
    setNextKey((k) => k + 1);
  }
  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  const validRows = rows.filter((r) => r.productId && Number(r.quantity) > 0);
  const total = validRows.reduce((sum, r) => sum + Number(r.quantity) * (Number(r.unitPrice) || 0), 0);
  const itemsJson = JSON.stringify(
    validRows.map((r) => ({ productId: r.productId, quantity: Number(r.quantity), unitPrice: Number(r.unitPrice) || 0 })),
  );

  return (
    <form action={formAction} className="erp-unified-sale-form" onKeyDown={preventEnterSubmit}>
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="warehouse_id" value={warehouseId} />
      <input type="hidden" name="items" value={itemsJson} />
      {isReturn && <input type="hidden" name="is_return" value="1" />}
      {isReturn && <input type="hidden" name="return_reason" value={returnReason} />}

      {isReturn && (
        <PageGuide tone="danger" className="mb-2">
          반품으로 등록하면 이 품목 수량만큼 재고가 증가하고, 매출 합계·미수금에서는 차감됩니다.
        </PageGuide>
      )}

      <div className="erp-field-grid">
        <div className="erp-field erp-span-6">
          <label htmlFor="unified-sale-customer">출고처 *</label>
          <PartySearchSelect id="unified-sale-customer" parties={customers} value={customerId} onChange={setCustomerId} />
        </div>
        <div className="erp-field erp-span-3">
          <label htmlFor="unified-sale-warehouse">창고 *</label>
          <ErpSelect
            id="unified-sale-warehouse"
            value={warehouseId}
            onChange={setWarehouseId}
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          />
        </div>
        <div className="erp-field erp-span-3">
          <label htmlFor="unified-sale-date">거래일자 *</label>
          <input id="unified-sale-date" type="date" name="order_date" defaultValue={today} className="erp-input" required />
        </div>
      </div>

      {isReturn && (
        <div className="erp-field" style={{ marginTop: 8 }}>
          <label htmlFor="unified-sale-return-reason">반품 사유</label>
          <ErpSelect
            id="unified-sale-return-reason"
            value={returnReason}
            onChange={setReturnReason}
            options={RETURN_REASONS.map((r) => ({ value: r, label: r }))}
          />
        </div>
      )}

      <div className="erp-field" style={{ marginTop: 8 }}>
        <label htmlFor="unified-sale-tax-type">과세구분</label>
        <ErpSelect
          id="unified-sale-tax-type"
          name="tax_type"
          value={taxType}
          onChange={setTaxType}
          style={{ maxWidth: 160 }}
          options={TAX_TYPES.map((t) => ({ value: t, label: t }))}
        />
      </div>

      <div className="erp-unified-sale-items">
        <div className="erp-unified-sale-items-head">
          <span>{isReturn ? "반품 품목 내역" : "품목 내역"}</span>
          <button type="button" className="erp-btn" style={{ minWidth: 0, fontSize: 11.5 }} onClick={addRow}>
            + 품목 추가
          </button>
        </div>
        {rows.map((row) => (
          <div key={row.key} className="erp-unified-sale-item-row">
            <ProductSearchSelect
              products={products}
              value={row.productId}
              onChange={(productId) => updateRow(row.key, { productId })}
              placeholder="품목 검색"
            />
            <input
              type="number"
              min="1"
              step="1"
              className="erp-input"
              style={{ width: 70 }}
              value={row.quantity}
              onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
              aria-label="수량"
            />
            <input
              type="number"
              min="0"
              step="1"
              className="erp-input"
              style={{ width: 100 }}
              placeholder="단가"
              value={row.unitPrice}
              onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })}
              aria-label="단가"
            />
            <span className="erp-unified-sale-item-subtotal">
              {formatNumber(Number(row.quantity || 0) * Number(row.unitPrice || 0))}원
            </span>
            <button
              type="button"
              className="erp-icon-link"
              onClick={() => removeRow(row.key)}
              disabled={rows.length <= 1}
              aria-label="품목 줄 삭제"
            >
              ✕
            </button>
          </div>
        ))}
        <div className="erp-unified-sale-items-total">
          전표 합계 <strong>{formatNumber(total)}원</strong>
        </div>
      </div>

      <div className="erp-field" style={{ marginTop: 8 }}>
        <label htmlFor="unified-sale-memo">적요 (선택)</label>
        <input id="unified-sale-memo" type="text" name="memo" autoComplete="off" className="erp-input" style={{ width: "100%" }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <button
          ref={submitRef}
          type="submit"
          disabled={pending || !customerId || !warehouseId || validRows.length === 0}
          className={`erp-btn erp-btn-primary${isReturn ? " erp-btn-danger" : ""}`}
        >
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 등록 중...
            </>
          ) : (
            `F7 ${isReturn ? "반품" : "매출"} 등록`
          )}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
