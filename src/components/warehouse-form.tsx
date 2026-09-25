"use client";

import { useActionState, useRef } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export function WarehouseForm({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="erp-field">
        <label htmlFor="wh-name">창고명</label>
        <input id="wh-name" type="text" name="name" autoComplete="off" className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label htmlFor="wh-location">위치 (선택)</label>
        <input id="wh-location" type="text" name="location" autoComplete="off" className="erp-input w-full" />
      </div>
      <div className="erp-field">
        <label aria-hidden="true">&nbsp;</label>
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary w-full">
          {pending ? "저장 중..." : "F7 창고 추가"}
        </button>
      </div>
      <div className="md:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
