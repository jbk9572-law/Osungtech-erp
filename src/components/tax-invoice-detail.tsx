"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FormMessage, type FormState } from "@/components/form-message";
import { GridBadge } from "@/components/grid/badge";
import { formatNumber } from "@/lib/format-number";

const INVOICE_TYPE_LABEL: Record<string, string> = {
  general: "일반",
  zero_rate: "영세율",
  consignment: "위수탁",
  consignment_zero_rate: "위수탁영세",
};
const CLAIM_TYPE_LABEL: Record<string, string> = { claim: "청구", receipt: "영수" };
const MODIFICATION_REASON_LABEL: Record<string, string> = {
  error_correction: "기재사항 착오정정",
  duplicate_issued: "착오에 의한 이중발급",
  supply_amount_change: "공급가액 변동",
  contract_cancelled: "계약의 해제",
  goods_returned: "재화의 환입",
  export_lc_after: "내국신용장 등 사후 개설",
};

type InvoiceItem = {
  id: string;
  line_date: string | null;
  item_name: string;
  spec: string | null;
  quantity: number | null;
  unit_price: number | null;
  supply_amount: number;
  tax_amount: number;
  remark: string | null;
  sort_order: number;
};

type Correction = {
  id: string;
  issue_date: string;
  modification_reason: string | null;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  remark: string | null;
  tax_invoice_items: InvoiceItem[];
};

export function TaxInvoiceDetail({
  invoice,
  corrections,
  salesOrderId,
  cancelAction,
}: {
  invoice: {
    invoice_type: string;
    issue_date: string;
    supply_amount: number;
    tax_amount: number;
    total_amount: number;
    cash_amount: number;
    check_amount: number;
    note_amount: number;
    credit_amount: number;
    claim_type: string;
    remark: string | null;
    consignee_name?: string | null;
    consignee_business_number?: string | null;
    consignee_representative_name?: string | null;
    tax_invoice_items: InvoiceItem[];
  };
  corrections: Correction[];
  salesOrderId: string;
  cancelAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [cancelState, cancelFormAction, cancelPending] = useActionState(cancelAction, undefined);
  const items = [...invoice.tax_invoice_items].sort((a, b) => a.sort_order - b.sort_order);
  const hasCorrections = corrections.length > 0;
  const isConsignment = invoice.invoice_type === "consignment" || invoice.invoice_type === "consignment_zero_rate";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <GridBadge tone="ok">계산서 발행완료</GridBadge>
        <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
          {new Date(invoice.issue_date).toLocaleDateString("ko-KR")} · {INVOICE_TYPE_LABEL[invoice.invoice_type] ?? invoice.invoice_type} ·{" "}
          {CLAIM_TYPE_LABEL[invoice.claim_type] ?? invoice.claim_type}
        </span>
        <Link
          href={`/sales/${salesOrderId}/tax-invoice/correct`}
          className="erp-btn"
          style={{ minWidth: 0, height: 24, padding: "0 10px", fontSize: 11.5, display: "inline-flex", alignItems: "center" }}
        >
          수정세금계산서 발행
        </Link>
        {!hasCorrections && (
          <form action={cancelFormAction}>
            <input type="hidden" name="sales_order_id" value={salesOrderId} />
            <button type="submit" disabled={cancelPending} className="erp-btn" style={{ minWidth: 0, height: 24, padding: "0 10px", fontSize: 11.5 }}>
              {cancelPending ? "처리 중..." : "미발행으로 되돌리기"}
            </button>
          </form>
        )}
      </div>
      <FormMessage state={cancelState} />

      {isConsignment && (
        <p className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
          수탁자: {invoice.consignee_name ?? "-"} ({invoice.consignee_business_number ?? "-"}) · {invoice.consignee_representative_name ?? "-"}
        </p>
      )}

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>날짜</th>
              <th>품목</th>
              <th>규격</th>
              <th className="num">수량</th>
              <th className="num">단가</th>
              <th className="num">공급가액</th>
              <th className="num">세액</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ color: "var(--erp-text-muted)" }}>
                  {item.line_date ? new Date(item.line_date).toLocaleDateString("ko-KR") : "-"}
                </td>
                <td>{item.item_name}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{item.spec || "-"}</td>
                <td className="num">{item.quantity != null ? formatNumber(item.quantity) : "-"}</td>
                <td className="num">{item.unit_price != null ? formatNumber(item.unit_price) : "-"}</td>
                <td className="num">{formatNumber(item.supply_amount)}</td>
                <td className="num">{formatNumber(item.tax_amount)}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{item.remark || "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="num" style={{ fontWeight: 700 }}>
                합계
              </td>
              <td className="num erp-doc-total">{formatNumber(invoice.supply_amount)}</td>
              <td className="num erp-doc-total">{formatNumber(invoice.tax_amount)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">결제 수단</span>
        </div>
        <div className="erp-detail-body" style={{ fontSize: 12.5, display: "flex", flexWrap: "wrap", gap: 20 }}>
          <AmountField label="합계금액" value={invoice.total_amount} bold />
          <AmountField label="현금" value={invoice.cash_amount} />
          <AmountField label="수표" value={invoice.check_amount} />
          <AmountField label="어음" value={invoice.note_amount} />
          <AmountField label="외상미수금" value={invoice.credit_amount} />
        </div>
      </div>

      {invoice.remark && (
        <p className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
          비고: {invoice.remark}
        </p>
      )}

      {hasCorrections && (
        <div className="erp-detail" style={{ marginTop: 0 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">수정 이력 ({corrections.length}건)</span>
          </div>
          <div className="erp-detail-body" style={{ fontSize: 12.5, display: "flex", flexDirection: "column", gap: 10 }}>
            {corrections.map((c) => (
              <div key={c.id} style={{ borderBottom: "1px solid var(--erp-border)", paddingBottom: 8 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <GridBadge tone="info">
                    {c.modification_reason ? MODIFICATION_REASON_LABEL[c.modification_reason] ?? c.modification_reason : "-"}
                  </GridBadge>
                  <span style={{ color: "var(--erp-text-muted)" }}>{new Date(c.issue_date).toLocaleDateString("ko-KR")}</span>
                  <span style={{ fontWeight: 700 }}>{formatNumber(c.total_amount)}원</span>
                </div>
                <ul style={{ marginTop: 4, paddingLeft: 16, color: "var(--erp-text-muted)" }}>
                  {[...c.tax_invoice_items]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((item) => (
                      <li key={item.id}>
                        {item.item_name} · {formatNumber(item.quantity ?? 0)} × {formatNumber(item.unit_price ?? 0)} ={" "}
                        {formatNumber(item.supply_amount)} (세액 {formatNumber(item.tax_amount)})
                      </li>
                    ))}
                </ul>
                {c.remark && <p style={{ marginTop: 4, color: "var(--erp-text-muted)" }}>비고: {c.remark}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AmountField({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ color: "var(--erp-text-muted)", fontSize: 11 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 400 }}>{formatNumber(value)}원</span>
    </div>
  );
}
