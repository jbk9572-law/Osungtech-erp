"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { GridBadge } from "@/components/grid/badge";
import { PageGuide } from "@/components/erp/page-guide";

// 계산서 발행 상태를 수기로 기록하는 패널 — 실제 국세청 전송(팝빌 등
// API 연동)은 아직 없고, "발행했다"는 사실과 계산서번호/발행일자만
// 남긴다(markInvoiceIssued/cancelInvoiceIssued, sales/actions.ts).
export function InvoiceStatusPanel({
  orderId,
  status,
  invoiceNumber,
  invoiceIssuedAt,
  today,
  markIssuedAction,
  cancelAction,
}: {
  orderId: string;
  status: string;
  invoiceNumber: string | null;
  invoiceIssuedAt: string | null;
  today: string;
  markIssuedAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
  cancelAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [markState, markFormAction, markPending] = useActionState(markIssuedAction, undefined);
  const [cancelState, cancelFormAction, cancelPending] = useActionState(cancelAction, undefined);

  if (status === "issued") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <GridBadge tone="ok">계산서 발행완료</GridBadge>
        <span style={{ color: "var(--erp-text-muted)" }}>
          {invoiceIssuedAt ? new Date(invoiceIssuedAt).toLocaleDateString("ko-KR") : "-"}
          {invoiceNumber ? ` · No.${invoiceNumber}` : ""}
        </span>
        <form action={cancelFormAction}>
          <input type="hidden" name="sales_order_id" value={orderId} />
          <button type="submit" disabled={cancelPending} className="erp-btn" style={{ minWidth: 0, height: 22, padding: "0 8px", fontSize: 11 }}>
            {cancelPending ? "처리 중..." : "미발행으로 되돌리기"}
          </button>
        </form>
        <FormMessage state={cancelState} />
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="mb-1">
        <GridBadge tone="muted">계산서 미발행</GridBadge>
      </div>
      <PageGuide>국세청 전송 연동 전까지는 발행 여부만 수기로 기록합니다.</PageGuide>
      <form action={markFormAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="sales_order_id" value={orderId} />
        <div className="erp-field">
          <label htmlFor="inv-date">발행일자</label>
          <input id="inv-date" type="date" name="invoice_issued_at" defaultValue={today} className="erp-input" required />
        </div>
        <div className="erp-field">
          <label htmlFor="inv-number">계산서번호 (선택)</label>
          <input id="inv-number" type="text" name="invoice_number" autoComplete="off" className="erp-input" style={{ width: 160 }} />
        </div>
        <button type="submit" disabled={markPending} className="erp-btn erp-btn-primary" style={{ height: 30 }}>
          {markPending ? "저장 중..." : "발행완료로 표시"}
        </button>
      </form>
      <FormMessage state={markState} />
    </div>
  );
}
