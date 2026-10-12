"use client";

import { useActionState, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";

// 연차 신청이 잔여일수 부족으로 막혔을 때, 관리자가 이 폼으로 사유와
// 함께 추가 연차를 부여한다(hr/actions.ts의 grantExtraLeave). 기본은
// 닫혀 있고, 버튼을 누르면 일수/사유 입력칸이 펼쳐진다 — 거의 안 쓰는
// 기능이라 평소엔 연차관리 표를 복잡하게 만들지 않는다.
export function LeaveGrantForm({
  action,
  userId,
  year,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  userId: string;
  year: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="erp-btn"
        style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}
        onClick={() => setOpen(true)}
      >
        + 추가 부여
      </button>
    );
  }

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="flex flex-col gap-1.5" style={{ minWidth: 220 }}>
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="year" value={year} />
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          name="days"
          step="0.5"
          min="0.5"
          placeholder="부여 일수"
          required
          className="erp-input"
          style={{ width: 90, height: 26, fontSize: 11.5 }}
        />
        <button
          type="submit"
          disabled={pending}
          className="erp-btn erp-btn-primary"
          style={{ minWidth: 0, height: 24, padding: "0 10px", fontSize: 11 }}
        >
          {pending ? "저장 중..." : "부여"}
        </button>
        <button
          type="button"
          className="erp-btn"
          style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}
          onClick={() => setOpen(false)}
        >
          취소
        </button>
      </div>
      <input
        type="text"
        name="reason"
        autoComplete="off"
        placeholder="부여 사유 (필수)"
        required
        className="erp-input"
        style={{ height: 26, fontSize: 11.5 }}
      />
      <FormMessage state={state} />
    </form>
  );
}
