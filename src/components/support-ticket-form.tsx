"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export function SupportTicketForm({
  action,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useKeyShortcut("F7", submitRef);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input name="subject" autoComplete="off" placeholder="제목" required className="erp-input" />
      <textarea
        name="message"
        placeholder="어떤 문제가 있었는지, 어떤 화면에서 발생했는지 자세히 적어주시면 빠르게 도와드릴 수 있습니다."
        rows={5}
        required
        className="erp-input"
        style={{ resize: "vertical" }}
      />
      <div className="flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 등록 중...
            </>
          ) : (
            "F7 문의 등록"
          )}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
