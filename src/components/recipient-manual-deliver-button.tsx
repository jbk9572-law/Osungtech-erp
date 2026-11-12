"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

type RecipientAction = (prevState: FormState, formData: FormData) => Promise<FormState>;

function RecipientActionForm({
  recipientId,
  officialDocumentId,
  action,
  label,
  pendingLabel,
}: {
  recipientId: string;
  officialDocumentId: string;
  action: RecipientAction;
  label: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="recipient_id" value={recipientId} />
      <input type="hidden" name="official_document_id" value={officialDocumentId} />
      <button type="submit" disabled={pending} className="erp-btn erp-u-h-24 erp-u-pad-0-8" style={{ minWidth: 0, fontSize: 11 }}>
        {pending ? pendingLabel : label}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

// "직접 발송 처리"는 항상 보여주고(사내/외부 공통 — 우편/방문 등 모든
// 수단을 아우르는 범용 처리), 팩스/알림톡은 외부 수신처에만 보여준다
// (사내 수신처는 이미 받은 공문함에서 바로 보이므로 별도 발송 수단이
// 필요 없다). 팩스/알림톡은 실제 외부 API 연동이 없어 테스트용 가짜
// 발송(가상 API, mock-send.ts)으로 동작한다.
export function RecipientManualDeliverButton({
  recipientId,
  officialDocumentId,
  action,
  kind,
  mockFaxAction,
  mockAlimtalkAction,
}: {
  recipientId: string;
  officialDocumentId: string;
  action: RecipientAction;
  kind?: string;
  mockFaxAction?: RecipientAction;
  mockAlimtalkAction?: RecipientAction;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <RecipientActionForm
        recipientId={recipientId}
        officialDocumentId={officialDocumentId}
        action={action}
        label="직접 발송 처리"
        pendingLabel="처리 중..."
      />
      {kind === "external" && mockFaxAction && (
        <RecipientActionForm
          recipientId={recipientId}
          officialDocumentId={officialDocumentId}
          action={mockFaxAction}
          label="팩스 발송(테스트)"
          pendingLabel="발송 중..."
        />
      )}
      {kind === "external" && mockAlimtalkAction && (
        <RecipientActionForm
          recipientId={recipientId}
          officialDocumentId={officialDocumentId}
          action={mockAlimtalkAction}
          label="알림톡 발송(테스트)"
          pendingLabel="발송 중..."
        />
      )}
    </div>
  );
}
