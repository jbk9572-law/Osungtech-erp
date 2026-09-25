"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { sendQuote } from "@/app/(dashboard)/quotes/send-action";

// send-action.ts를 여기서 직접 import한다(서버 페이지가 prop으로 넘기지
// 않음) — send-action.ts 상단 주석 참고. 서버 컴포넌트가 이 액션을 직접
// import하면 cloudflare:sockets 의존 모듈까지 페이지의 서버 번들에 끌려
// 들어가 next build가 깨진다.
export function SendQuoteButton({ id, sent }: { id: string; sent: boolean }) {
  const [state, formAction, pending] = useActionState(sendQuote, undefined);

  return (
    <div className="inline-flex items-center gap-2">
      <form action={formAction} className="inline-flex">
        <input type="hidden" name="id" value={id} />
        <button type="submit" disabled={pending} className="erp-btn">
          {pending ? "발송 중..." : sent ? "재발송" : "이메일 발송"}
        </button>
      </form>
      <FormMessage state={state} />
    </div>
  );
}
