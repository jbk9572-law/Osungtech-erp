"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { measureDbLatency } from "@/app/platform-admin/settings/actions";

// 플랫폼 환경설정의 "서버 진단" — 버튼을 누르면 서버가 DB까지의 왕복 시간을 재서 보여준다.
export function DbLatencyProbe() {
  const [state, action, pending] = useActionState(measureDbLatency, undefined);
  return (
    <form action={action} className="erp-u-flex erp-u-items-center erp-u-gap-8">
      <button type="submit" className="erp-btn" disabled={pending}>
        {pending ? "재는 중..." : "서버 → DB 응답 속도 재기"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
