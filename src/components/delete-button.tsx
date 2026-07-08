"use client";

import { useActionState, useRef } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export function DeleteButton({
  action,
  id,
  confirmMessage = "정말 삭제하시겠습니까?",
  label = "삭제",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  confirmMessage?: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F6", buttonRef);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button ref={buttonRef} type="submit" disabled={pending} className="erp-btn erp-btn-danger">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 삭제 중...
          </>
        ) : (
          `F6 ${label}`
        )}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
