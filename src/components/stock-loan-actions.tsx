"use client";

import { useActionState, useState } from "react";
import { returnStockLoan, cancelStockLoan } from "@/app/(dashboard)/inventory/loans/actions";
import { NumberInput } from "@/components/number-input";
import { FormMessage } from "@/components/form-message";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";

type LoanItem = { id: string; name: string; unit: string; outstanding: number; returned: number };

// 일시반출 현황 한 줄의 처리 버튼 — [반납 처리](품목별 반납 수량 입력, 기본값은 남은 수량 전부) / [취소](반납이 하나도 없을 때만).
// 반납 수량은 미반납 수량 이하만 받는다(서버 DB 함수도 같은 검사를 한다).
export function StockLoanActions({ loanId, items }: { loanId: string; items: LoanItem[] }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(items.map((i) => [i.id, i.outstanding])));
  const [state, formAction, pending] = useActionState(returnStockLoan, undefined);
  const anyReturned = items.some((i) => i.returned > 0);
  const lines = items.map((i) => ({ itemId: i.id, quantity: Math.min(Math.max(qty[i.id] ?? 0, 0), i.outstanding) })).filter((l) => l.quantity > 0);

  return (
    <div className="erp-u-flex erp-u-items-center erp-u-gap-6 erp-u-flex-wrap">
      <button type="button" className="erp-btn erp-btn-sm erp-btn-primary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        반납 처리
      </button>
      {!anyReturned && (
        <InlineConfirmDelete
          action={cancelStockLoan}
          hiddenFields={{ loan_id: loanId }}
          warningText="반출을 취소하면 빠졌던 재고가 되돌아옵니다."
          triggerLabel="취소"
          triggerClassName="erp-btn erp-btn-sm"
        />
      )}
      {open && (
        <form action={formAction} className="erp-u-w-full erp-u-pad-6-10 erp-u-bg-page erp-u-border erp-u-radius-md">
          <input type="hidden" name="loan_id" value={loanId} />
          <input type="hidden" name="items" value={JSON.stringify(lines)} />
          {items.map((i) => (
            <label key={i.id} className="erp-loan-return-row">
              <span className="erp-loan-return-name">{i.name}</span>
              <span className="erp-u-muted erp-u-text-xs erp-u-nowrap">남은 {i.outstanding}{i.unit}</span>
              <span className="erp-loan-return-input">
                <NumberInput value={qty[i.id] ?? 0} onChange={(n) => setQty((prev) => ({ ...prev, [i.id]: n }))} allowFormula className="erp-input" />
              </span>
              {(qty[i.id] ?? 0) > i.outstanding && <span className="erp-u-danger erp-u-text-xs erp-u-nowrap">최대 {i.outstanding}</span>}
            </label>
          ))}
          <div className="erp-u-flex erp-u-items-center erp-u-gap-8">
            <button type="submit" className="erp-btn erp-btn-sm erp-btn-primary" disabled={pending || lines.length === 0}>
              {pending ? "처리 중..." : "반납 확정"}
            </button>
            <FormMessage state={state} />
          </div>
        </form>
      )}
    </div>
  );
}
