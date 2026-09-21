"use client";

import { useActionState } from "react";
import { syncMailAction } from "@/app/(dashboard)/mail/actions";
import { FormMessage } from "@/components/form-message";

export function SyncMailButton() {
  const [state, formAction, pending] = useActionState(syncMailAction, undefined);

  return (
    <div className="flex items-center gap-2">
      <form action={formAction}>
        <button type="submit" className="erp-btn" disabled={pending}>
          {pending ? "동기화 중..." : "🔄 동기화"}
        </button>
      </form>
      <FormMessage state={state} />
    </div>
  );
}
