"use client";

import { useActionState, useEffect, useRef } from "react";
import { createRack } from "@/app/(dashboard)/inventory/locations/actions";
import { FormMessage } from "@/components/form-message";

export function CreateRackForm() {
  const [state, formAction, pending] = useActionState(createRack, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="erp-field" style={{ minWidth: 160 }}>
        <label htmlFor="rack-name">랙 이름</label>
        <input
          id="rack-name"
          name="rack"
          type="text"
          autoComplete="off"
          placeholder="예: B"
          maxLength={6}
          required
          className="erp-input"
        />
      </div>
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 추가 중...
          </>
        ) : (
          "+ 랙 추가 (파렛트 4자리 자동 생성)"
        )}
      </button>
      <div style={{ flexBasis: "100%" }}>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
