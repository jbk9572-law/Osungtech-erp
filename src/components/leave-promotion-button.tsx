"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

// 연차 사용촉진(근로기준법 61조) 1차/2차 통지를 "보냈다"고 기록하는
// 버튼 하나짜리 폼 — 실제 통지는 회사가 이미 쓰는 방법(서면·메신저 등)으로
// 하고, 여기서는 그 사실과 시점만 증빙으로 남긴다.
export function LeavePromotionButton({
  action,
  userId,
  year,
  stage,
  remainingDays,
  sentAt,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  userId: string;
  year: number;
  stage: 1 | 2;
  remainingDays: number;
  // 이미 보낸 적이 있으면 그 시각 — 버튼 대신 발송 일시를 보여준다.
  sentAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  if (sentAt) {
    return (
      <span className="text-xs erp-u-muted">
        {stage}차 발송됨 ({new Date(sentAt).toLocaleDateString("ko-KR")})
      </span>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="stage" value={stage} />
      <input type="hidden" name="remaining_days" value={remainingDays} />
      <button type="submit" disabled={pending} className="erp-btn erp-btn-sm erp-u-minw-0 erp-u-text-sm">
        {pending ? "처리 중..." : `${stage}차 통지 발송`}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
