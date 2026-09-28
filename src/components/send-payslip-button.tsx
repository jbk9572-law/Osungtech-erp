"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { sendPayslip } from "@/app/(dashboard)/hr/payroll/send-action";

// send-action.ts를 여기서 직접 import한다(서버 페이지가 prop으로 넘기지
// 않음) — send-quote-button.tsx와 같은 이유. 서버 컴포넌트가 이 액션을
// 직접 import하면 cloudflare:sockets 의존 모듈까지 페이지의 서버
// 번들에 끌려 들어가 next build가 깨진다.
export function SendPayslipButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(sendPayslip, undefined);

  return (
    <div className="inline-flex items-center gap-2">
      <form action={formAction} className="inline-flex">
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={pending}
          className="erp-btn"
          style={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
        >
          {pending ? "발송 중..." : "이메일 발송"}
        </button>
      </form>
      <FormMessage state={state} />
    </div>
  );
}
