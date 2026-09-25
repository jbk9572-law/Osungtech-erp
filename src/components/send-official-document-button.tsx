"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { sendOfficialDocument } from "@/app/(dashboard)/official-documents/send-action";

// send-action.ts를 여기서 직접 import한다(서버 페이지가 prop으로 넘기지
// 않음) — 그 파일 상단 주석 참고. 서버 컴포넌트가 이 액션을 직접
// import하면 cloudflare:sockets 의존 모듈까지 페이지의 서버 번들에
// 끌려 들어가 next build가 깨진다.
export function SendOfficialDocumentButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(sendOfficialDocument, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? "발송 중..." : "발송 처리"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
