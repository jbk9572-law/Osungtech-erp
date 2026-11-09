"use client";

import { useActionState, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { RichTextEditor } from "@/components/rich-text-editor-dynamic";
import { ErpSelect } from "@/components/erp/erp-select";

export function SupportTicketReplyForm({
  ticketId,
  defaultReply,
  action,
}: {
  ticketId: string;
  defaultReply?: string | null;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [reply, setReply] = useState(defaultReply ?? "");
  const [status, setStatus] = useState("answered");

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={ticketId} />
      <input type="hidden" name="reply" value={reply} />
      <RichTextEditor value={reply} onChange={setReply} placeholder="답변 내용을 입력하세요." minHeight={120} />
      <div className="flex items-center gap-2">
        <ErpSelect
          name="status"
          value={status}
          onChange={setStatus}
          style={{ width: 120 }}
          options={[
            { value: "answered", label: "답변 완료" },
            { value: "closed", label: "종료" },
          ]}
        />
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 등록 중...
            </>
          ) : (
            "답변 등록"
          )}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
