"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { createTaxInvoice } from "@/app/(dashboard)/sales/[id]/tax-invoice/actions";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { KeyboardHintBar } from "@/components/erp/keyboard-hint-bar";
import { PageGuide } from "@/components/erp/page-guide";
import { ErpSelect } from "@/components/erp/erp-select";
import {
  applyTaxInvoiceRowPatch,
  blankTaxInvoiceRow,
  seedTaxInvoiceRows,
  summarizeTaxInvoiceRows,
  type TaxInvoiceRow,
} from "@/lib/tax-invoice-rows";
import { TaxInvoiceItemsGrid } from "@/components/tax-invoice-items-grid";
import { formatNumber } from "@/lib/format-number";

export type SupplierInfo = {
  name: string | null;
  businessNumber: string | null;
  representativeName: string | null;
  address: string | null;
  businessType: string | null;
  businessItem: string | null;
  email: string | null;
};

export function TaxInvoiceForm({
  salesOrderId,
  today,
  supplier,
  buyer,
  initialRows,
  defaultInvoiceType = "general",
}: {
  salesOrderId: string;
  today: string;
  // 공급자(우리 회사) — company_profile에서 가져온 값, 읽기 전용 표시.
  supplier: SupplierInfo;
  // 공급받는자(거래처) — customers에서 가져온 값, 읽기 전용 표시(업태/종목이
  // 비어있으면 거래처 정보 화면에서 채워달라는 안내만 보여준다).
  buyer: SupplierInfo;
  initialRows: { itemName: string; spec: string; quantity: number; unitPrice: number }[];
  // 매출 건의 과세구분(tax_type)에서 맞춰 온 기본값 — 과세→일반,
  // 영세→영세율(lib/tax-evidence-type.ts). 사용자가 여기서 직접 바꿀 수도
  // 있다(위수탁 등은 과세구분만으로 알 수 없어서 수동 선택 영역).
  defaultInvoiceType?: "general" | "zero_rate";
}) {
  const [state, formAction, pending] = useActionState(createTaxInvoice, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const [invoiceType, setInvoiceType] = useState<"general" | "zero_rate" | "consignment" | "consignment_zero_rate">(defaultInvoiceType);
  const [claimType, setClaimType] = useState("claim");
  const isConsignment = invoiceType === "consignment" || invoiceType === "consignment_zero_rate";

  const seeded = useMemo<TaxInvoiceRow[]>(
    () => seedTaxInvoiceRows(initialRows, today),
    [initialRows, today],
  );

  const { rows, addRow, removeRow, setRows } = useKeyedRows<TaxInvoiceRow>(seeded, (key) => blankTaxInvoiceRow(key, today));

  function updateRow(key: number, patch: Partial<TaxInvoiceRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? applyTaxInvoiceRowPatch(r, patch) : r)));
  }

  const { validRows, totalSupply, totalTax, totalAmount, itemsJson } = summarizeTaxInvoiceRows(rows);

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="erp-doc-sheet">
      <div className="erp-doc-paper flex flex-col gap-3">
        <input type="hidden" name="sales_order_id" value={salesOrderId} />
        <input type="hidden" name="items" value={itemsJson} />
        <input type="hidden" name="supply_amount" value={totalSupply} />
        <input type="hidden" name="tax_amount" value={totalTax} />
        <input type="hidden" name="total_amount" value={totalAmount} />

        <h2 className="erp-doc-title">세 금 계 산 서</h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="erp-detail erp-u-mt-0">
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active">공급자</span>
            </div>
            <div className="erp-detail-body erp-u-text-base">
              <PartyRow label="등록번호" value={supplier.businessNumber} />
              <PartyRow label="상호" value={supplier.name} />
              <PartyRow label="성명" value={supplier.representativeName} />
              <PartyRow label="사업장" value={supplier.address} />
              <PartyRow label="업태" value={supplier.businessType} />
              <PartyRow label="종목" value={supplier.businessItem} />
              <PartyRow label="이메일" value={supplier.email} />
            </div>
          </div>
          <div className="erp-detail erp-u-mt-0">
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active">공급받는자</span>
            </div>
            <div className="erp-detail-body erp-u-text-base">
              <PartyRow label="등록번호" value={buyer.businessNumber} />
              <PartyRow label="상호" value={buyer.name} />
              <PartyRow label="성명" value={buyer.representativeName} />
              <PartyRow label="사업장" value={buyer.address} />
              <PartyRow label="업태" value={buyer.businessType} missingHint="거래처 정보에서 입력해주세요" />
              <PartyRow label="종목" value={buyer.businessItem} missingHint="거래처 정보에서 입력해주세요" />
              <PartyRow label="이메일" value={buyer.email} />
            </div>
          </div>
        </div>

        <div className="erp-doc-header">
          <div className="erp-doc-header-row">
            <label htmlFor="ti-date" className="erp-doc-header-label">작성일자</label>
            <span className="erp-doc-header-value">
              <input id="ti-date" name="issue_date" type="date" defaultValue={today} className="erp-input" required />
            </span>
          </div>
          <div className="erp-doc-header-row">
            <label htmlFor="ti-type" className="erp-doc-header-label">종류</label>
            <span className="erp-doc-header-value">
              <ErpSelect
                id="ti-type"
                name="invoice_type"
                value={invoiceType}
                onChange={(v) => setInvoiceType(v as typeof invoiceType)}
                options={[
                  { value: "general", label: "일반" },
                  { value: "zero_rate", label: "영세율" },
                  { value: "consignment", label: "위수탁" },
                  { value: "consignment_zero_rate", label: "위수탁영세" },
                ]}
              />
            </span>
          </div>
          <div className="erp-doc-header-row">
            <label htmlFor="ti-claim" className="erp-doc-header-label">청구/영수</label>
            <span className="erp-doc-header-value">
              <ErpSelect
                id="ti-claim"
                name="claim_type"
                value={claimType}
                onChange={setClaimType}
                options={[
                  { value: "claim", label: "청구" },
                  { value: "receipt", label: "영수" },
                ]}
              />
            </span>
          </div>
          {isConsignment && (
            <>
              <div className="erp-doc-header-row">
                <label htmlFor="ti-consignee-name" className="erp-doc-header-label">수탁자 상호</label>
                <span className="erp-doc-header-value">
                  <input id="ti-consignee-name" name="consignee_name" className="erp-input" autoComplete="off" required />
                </span>
              </div>
              <div className="erp-doc-header-row">
                <label htmlFor="ti-consignee-biz" className="erp-doc-header-label">수탁자 등록번호</label>
                <span className="erp-doc-header-value">
                  <input id="ti-consignee-biz" name="consignee_business_number" className="erp-input" autoComplete="off" required />
                </span>
              </div>
              <div className="erp-doc-header-row">
                <label htmlFor="ti-consignee-rep" className="erp-doc-header-label">수탁자 성명</label>
                <span className="erp-doc-header-value">
                  <input id="ti-consignee-rep" name="consignee_representative_name" className="erp-input" autoComplete="off" required />
                </span>
              </div>
            </>
          )}
          <div className="erp-doc-header-row erp-doc-header-row-full">
            <label htmlFor="ti-remark" className="erp-doc-header-label">비고</label>
            <span className="erp-doc-header-value">
              <textarea id="ti-remark" name="remark" rows={2} className="erp-input erp-textarea-compact w-full erp-u-border-none" />
            </span>
          </div>
        </div>
        {isConsignment && (
          <PageGuide className="mb-0">
            위수탁 거래 — 실제 공급자(위탁자)는 위 &ldquo;공급자&rdquo; 칸 그대로이고, 수탁자는 이 거래를 대신 처리/발급하는 쪽의 정보입니다.
          </PageGuide>
        )}

        <TaxInvoiceItemsGrid
          rows={rows}
          onUpdate={updateRow}
          onRemove={removeRow}
          onAdd={addRow}
          totalSupply={totalSupply}
          totalTax={totalTax}
        />

        <div className="erp-doc-header">
          <div className="erp-doc-header-row">
            <span className="erp-doc-header-label">합계금액</span>
            <span className="erp-doc-header-value erp-u-bold">
              {formatNumber(totalAmount)}원
            </span>
          </div>
          <div className="erp-doc-header-row">
            <label htmlFor="ti-cash" className="erp-doc-header-label">현금</label>
            <span className="erp-doc-header-value">
              <NumberInputField id="ti-cash" name="cash_amount" />
            </span>
          </div>
          <div className="erp-doc-header-row">
            <label htmlFor="ti-check" className="erp-doc-header-label">수표</label>
            <span className="erp-doc-header-value">
              <NumberInputField id="ti-check" name="check_amount" />
            </span>
          </div>
          <div className="erp-doc-header-row">
            <label htmlFor="ti-note" className="erp-doc-header-label">어음</label>
            <span className="erp-doc-header-value">
              <NumberInputField id="ti-note" name="note_amount" />
            </span>
          </div>
          <div className="erp-doc-header-row">
            <label htmlFor="ti-credit" className="erp-doc-header-label">외상미수금</label>
            <span className="erp-doc-header-value">
              <NumberInputField id="ti-credit" name="credit_amount" />
            </span>
          </div>
        </div>

        <FormMessage state={state} />

        <button
          ref={submitRef}
          type="submit"
          className="erp-btn erp-btn-primary"
          disabled={pending || validRows.length === 0}
          style={{ alignSelf: "flex-start" }}
        >
          {pending ? "발행 중..." : "F7 세금계산서 발행"}
        </button>
      </div>
      <KeyboardHintBar items={[{ key: "F7", label: "발행" }]} />
    </form>
  );
}

function PartyRow({ label, value, missingHint }: { label: string; value: string | null; missingHint?: string }) {
  return (
    <div className="erp-u-flex erp-u-items-center erp-u-gap-8 erp-u-mb-4" style={{ minHeight: 24 }}>
      <span className="erp-u-muted erp-u-flex-none" style={{ width: 64 }}>{label}</span>
      {value ? (
        <span>{value}</span>
      ) : (
        <span className="erp-u-muted">{missingHint ?? "-"}</span>
      )}
    </div>
  );
}

// 순수 숫자 필드라 NumberInput(제어 컴포넌트)이 아니라, 이 폼 전체가
// FormData로 제출되는 비제어 form이라서 그냥 name 있는 숫자 input으로
// 충분하다(콤마 등 서식 없이 그대로 제출).
function NumberInputField({ id, name }: { id: string; name: string }) {
  return (
    <input id={id} name={name} type="number" min="0" step="1" defaultValue={0} className="erp-input erp-u-text-right" />
  );
}
