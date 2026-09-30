"use client";

import { useActionState, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { RichTextEditor } from "@/components/rich-text-editor";

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

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={ticketId} />
      <input type="hidden" name="reply" value={reply} />
      <RichTextEditor value={reply} onChange={setReply} placeholder="답변 내용을 입력하세요." minHeight={120} />
      <div className="flex items-center gap-2">
        <select name="status" defaultValue="answered" className="erp-input" style={{ width: 120 }}>
          <option value="answered">답변 완료</option>
          <option value="closed">종료</option>
        </select>
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
