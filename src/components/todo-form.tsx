"use client";

import { useActionState, useRef } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export function TodoForm({
  action,
  submitLabel = "등록",
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel?: string;
  initial?: { id: string; title: string; memo: string; dueDate: string | null };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input
        name="title"
        placeholder="할 일"
        required
        defaultValue={initial?.title}
        className="erp-input md:col-span-2"
      />
      <input name="due_date" type="date" defaultValue={initial?.dueDate ?? ""} className="erp-input" />
      <textarea
        name="memo"
        placeholder="메모"
        rows={6}
        defaultValue={initial?.memo}
        className="erp-input md:col-span-3"
        style={{ resize: "vertical" }}
      />
      <div className="md:col-span-3 flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 저장 중...
            </>
          ) : (
            `F7 ${submitLabel}`
          )}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
