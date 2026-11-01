"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { setTenantClosingDate } from "@/app/(dashboard)/settings/features/actions";

// 환경설정 > 기능 관리 "마감일 설정" — 이 날짜(포함) 이전 거래일자의
// 매출/매입 전표는 관리자만 수정/삭제할 수 있다(migration 207). 비우고
// 저장하면 제한이 풀린다. 다른 설정 화면의 단일 입력칸 폼(예: 회사정보)과
// 같은 useActionState + FormMessage 패턴을 그대로 쓴다.
export function ClosingDateForm({ closingDate }: { closingDate: string | null }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setTenantClosingDate, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="erp-field">
        <label htmlFor="closing-date">마감일</label>
        <input
          id="closing-date"
          name="closing_date"
          type="date"
          defaultValue={closingDate ?? ""}
          className="erp-input"
        />
      </div>
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? "저장 중..." : "저장"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
