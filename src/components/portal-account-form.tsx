"use client";

import { useActionState, useRef, useEffect } from "react";
import { createPortalAccount, disablePortalAccount } from "@/app/(dashboard)/customers/actions";
import { FormMessage } from "@/components/form-message";

export function PortalAccountForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState(createPortalAccount, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="customer_id" value={customerId} />
      <div className="erp-field" style={{ minWidth: 160 }}>
        <label>아이디</label>
        <input name="username" type="text" autoComplete="off" required className="erp-input" style={{ width: "100%" }} />
      </div>
      <div className="erp-field" style={{ minWidth: 160 }}>
        <label>비밀번호 (비워두면 자동 생성)</label>
        <input name="password" type="text" autoComplete="off" className="erp-input" style={{ width: "100%" }} />
      </div>
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
        {pending ? "발급 중..." : "포털 계정 발급"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function PortalAccountDisableForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(disablePortalAccount, undefined);
  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="erp-btn erp-btn-danger" style={{ height: 22, padding: "1px 8px", fontSize: 11 }} disabled={pending}>
        {pending ? "처리 중..." : "비활성화"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
