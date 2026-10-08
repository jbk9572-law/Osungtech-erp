"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { createTaxInvoice } from "@/app/(dashboard)/sales/[id]/tax-invoice/actions";
import { NumberInput } from "@/components/number-input";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { KeyboardHintBar } from "@/components/erp/keyboard-hint-bar";
import { PageGuide } from "@/components/erp/page-guide";
import { calcVat } from "@/lib/tax";
import { formatNumber } from "@/lib/format-number";

type Row = {
  key: number;
  lineDate: string;
  itemName: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  supplyAmount: number;
  taxAmount: number;
  remark: string;
};

// 홈택스 화면의 품목 줄은 최대 16개까지 추가 가능 — 같은 상한을 둔다.
const MAX_ROWS = 16;

// table-layout: auto(기본값)로는 모바일 폭에서 입력칸이 찌그러진다 —
// new-quote-form.tsx와 같은 기법으로 표를 모든 칸 폭의 합만큼 고정폭으로
// 못박는다.
const ITEM_GRID_TOTAL_WIDTH = 110 + 200 + 110 + 70 + 90 + 110 + 90 + 140 + 50;

function blankRow(key: number, defaultDate: string): Row {
  return { key, lineDate: defaultDate, itemName: "", spec: "", quantity: 0, unitPrice: 0, supplyAmount: 0, taxAmount: 0, remark: "" };
}

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
  const isConsignment = invoiceType === "consignment" || invoiceType === "consignment_zero_rate";

  const seeded = useMemo<Row[]>(() => {
    if (initialRows.length === 0) return [blankRow(0, today)];
    return initialRows.slice(0, MAX_ROWS).map((r, i) => {
      const supplyAmount = r.quantity * r.unitPrice;
      return {
        key: i,
        lineDate: today,
        itemName: r.itemName,
        spec: r.spec,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        supplyAmount,
        taxAmount: calcVat(supplyAmount),
        remark: "",
      };
    });
  }, [initialRows, today]);

  const { rows, addRow, removeRow, setRows } = useKeyedRows<Row>(seeded, (key) => blankRow(key, today));

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (patch.quantity !== undefined || patch.unitPrice !== undefined) {
          next.supplyAmount = next.quantity * next.unitPrice;
          next.taxAmount = calcVat(next.supplyAmount);
        }
        return next;
      }),
    );
  }

  const validRows = rows.filter((r) => r.itemName.trim());
  const totalSupply = validRows.reduce((sum, r) => sum + r.supplyAmount, 0);
  const totalTax = validRows.reduce((sum, r) => sum + r.taxAmount, 0);
  const totalAmount = totalSupply + totalTax;
  const itemsJson = JSON.stringify(
    validRows.map((r) => ({
      lineDate: r.lineDate || null,
      itemName: r.itemName,
      spec: r.spec || null,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      supplyAmount: r.supplyAmount,
      taxAmount: r.taxAmount,
      remark: r.remark || null,
    })),
  );

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
          <div className="erp-detail" style={{ marginTop: 0 }}>
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active">공급자</span>
            </div>
            <div className="erp-detail-body" style={{ fontSize: 12.5 }}>
              <PartyRow label="등록번호" value={supplier.businessNumber} />
              <PartyRow label="상호" value={supplier.name} />
              <PartyRow label="성명" value={supplier.representativeName} />
              <PartyRow label="사업장" value={supplier.address} />
              <PartyRow label="업태" value={supplier.businessType} />
              <PartyRow label="종목" value={supplier.businessItem} />
              <PartyRow label="이메일" value={supplier.email} />
            </div>
          </div>
          <div className="erp-detail" style={{ marginTop: 0 }}>
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active">공급받는자</span>
            </div>
            <div className="erp-detail-body" style={{ fontSize: 12.5 }}>
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
              <select
                id="ti-type"
                name="invoice_type"
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value as typeof invoiceType)}
                className="erp-select"
              >
                <option value="general">일반</option>
                <option value="zero_rate">영세율</option>
                <option value="consignment">위수탁</option>
                <option value="consignment_zero_rate">위수탁영세</option>
              </select>
            </span>
          </div>
          <div className="erp-doc-header-row">
            <label htmlFor="ti-claim" className="erp-doc-header-label">청구/영수</label>
            <span className="erp-doc-header-value">
              <select id="ti-claim" name="claim_type" defaultValue="claim" className="erp-select">
                <option value="claim">청구</option>
                <option value="receipt">영수</option>
              </select>
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
              <textarea id="ti-remark" name="remark" rows={2} className="erp-input erp-textarea-compact w-full" style={{ border: "none" }} />
            </span>
          </div>
        </div>
        {isConsignment && (
          <PageGuide className="mb-0">
            위수탁 거래 — 실제 공급자(위탁자)는 위 &ldquo;공급자&rdquo; 칸 그대로이고, 수탁자는 이 거래를 대신 처리/발급하는 쪽의 정보입니다.
          </PageGuide>
        )}

        <div className="erp-grid-wrap">
          <table
            className="erp-grid"
            style={{ tableLayout: "fixed", width: ITEM_GRID_TOTAL_WIDTH, minWidth: ITEM_GRID_TOTAL_WIDTH }}
          >
            <thead>
              <tr>
                <th style={{ width: 110 }}>날짜</th>
                <th style={{ width: 200 }}>품목</th>
                <th style={{ width: 110 }}>규격</th>
                <th className="num" style={{ width: 70 }}>수량</th>
                <th className="num" style={{ width: 90 }}>단가</th>
                <th className="num" style={{ width: 110 }}>공급가액</th>
                <th className="num" style={{ width: 90 }}>세액</th>
                <th style={{ width: 140 }}>비고</th>
                <th style={{ width: 50 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <input
                      type="date"
                      value={row.lineDate}
                      onChange={(e) => updateRow(row.key, { lineDate: e.target.value })}
                      className="erp-input"
                    />
                  </td>
                  <td>
                    <input
                      value={row.itemName}
                      onChange={(e) => updateRow(row.key, { itemName: e.target.value })}
                      className="erp-input"
                      autoComplete="off"
                    />
                  </td>
                  <td>
                    <input
                      value={row.spec}
                      onChange={(e) => updateRow(row.key, { spec: e.target.value })}
                      className="erp-input"
                      autoComplete="off"
                    />
                  </td>
                  <td>
                    <NumberInput value={row.quantity} onChange={(n) => updateRow(row.key, { quantity: n })} className="erp-input" />
                  </td>
                  <td>
                    <NumberInput value={row.unitPrice} onChange={(n) => updateRow(row.key, { unitPrice: n })} className="erp-input" />
                  </td>
                  <td>
                    <NumberInput
                      value={row.supplyAmount}
                      onChange={(n) => updateRow(row.key, { supplyAmount: n })}
                      className="erp-input"
                    />
                  </td>
                  <td>
                    <NumberInput value={row.taxAmount} onChange={(n) => updateRow(row.key, { taxAmount: n })} className="erp-input" />
                  </td>
                  <td>
                    <input
                      value={row.remark}
                      onChange={(e) => updateRow(row.key, { remark: e.target.value })}
                      className="erp-input"
                      autoComplete="off"
                    />
                  </td>
                  <td>
                    <button type="button" className="erp-btn" onClick={() => removeRow(row.key)} style={{ minWidth: 0 }}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="num" style={{ fontWeight: 700 }}>
                  합계
                </td>
                <td className="num erp-doc-total">{formatNumber(totalSupply)}</td>
                <td className="num erp-doc-total">{formatNumber(totalTax)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>

        <button
          type="button"
          className="erp-btn"
          onClick={addRow}
          disabled={rows.length >= MAX_ROWS}
          style={{ alignSelf: "flex-start" }}
        >
          + 품목 추가 ({rows.length}/{MAX_ROWS})
        </button>

        <div className="erp-doc-header">
          <div className="erp-doc-header-row">
            <span className="erp-doc-header-label">합계금액</span>
            <span className="erp-doc-header-value" style={{ fontWeight: 700 }}>
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
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 24, marginBottom: 4 }}>
      <span style={{ width: 64, flex: "0 0 auto", color: "var(--erp-text-muted)" }}>{label}</span>
      {value ? (
        <span>{value}</span>
      ) : (
        <span style={{ color: "var(--erp-text-muted)" }}>{missingHint ?? "-"}</span>
      )}
    </div>
  );
}

// 순수 숫자 필드라 NumberInput(제어 컴포넌트)이 아니라, 이 폼 전체가
// FormData로 제출되는 비제어 form이라서 그냥 name 있는 숫자 input으로
// 충분하다(콤마 등 서식 없이 그대로 제출).
function NumberInputField({ id, name }: { id: string; name: string }) {
  return (
    <input id={id} name={name} type="number" min="0" step="1" defaultValue={0} className="erp-input" style={{ textAlign: "right" }} />
  );
}
