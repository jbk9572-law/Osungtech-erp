"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { PageGuide } from "@/components/erp/page-guide";

export function IssueTaxInvoiceMockButton({
  salesOrderId,
  action,
}: {
  salesOrderId: string;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div className="mb-3">
      <PageGuide className="mb-2">
        아래 수기입력 폼 대신, 이 매출 건의 품목을 그대로 불러와 국세청 전자세금계산서를 바로 발행해볼 수 있습니다.
        실제 홈택스 연동 전까지는 테스트용 가상 응답(승인번호)만 돌려줍니다 — 실제 비용이 드는 외부 발송은 없습니다.
      </PageGuide>
      <form action={formAction}>
        <input type="hidden" name="sales_order_id" value={salesOrderId} />
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? "발행 중..." : "국세청 전자발행(테스트)"}
        </button>
      </form>
      <FormMessage state={state} />
    </div>
  );
}
