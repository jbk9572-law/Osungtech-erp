"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { RichTextEditor } from "@/components/rich-text-editor";

export function SupportTicketForm({
  action,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useKeyShortcut("F7", submitRef);
  const [message, setMessage] = useState("");

  // 리치텍스트 에디터는 React가 값을 들고 있는 제어 컴포넌트라 네이티브
  // form.reset()으로는 안 비워진다 — state가 바뀐(=새로 제출된) 시점에
  // 렌더링 도중 직접 비워준다(effect 안에서 setState하면 리렌더가
  // 한 번 더 겹쳐 도는 걸 피하려고, quick-payment-request-form.tsx와
  // 동일하게 렌더 중 파생 상태 갱신 패턴을 쓴다).
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) setMessage("");
  }

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input name="subject" autoComplete="off" placeholder="제목" required className="erp-input" />
      <input type="hidden" name="message" value={message} />
      <RichTextEditor
        value={message}
        onChange={setMessage}
        placeholder="어떤 문제가 있었는지, 어떤 화면에서 발생했는지 자세히 적어주시면 빠르게 도와드릴 수 있습니다."
        minHeight={160}
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
