"use client";

import { useActionState } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";

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
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "삭제 중..." : label}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
