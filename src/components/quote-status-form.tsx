"use client";

import { useTransition } from "react";
import { updateQuoteStatus } from "@/app/(dashboard)/quotes/actions";

const STATUS_OPTIONS = [
  { value: "draft", label: "초안" },
  { value: "sent", label: "발송" },
  { value: "rejected", label: "거절" },
  { value: "expired", label: "만료" },
];

// "accepted"(승인)는 매출 전환 버튼을 통해서만 되게 하고 여기서는 뺐다 —
// 직접 상태만 바꾸면 실제 매출 없이 "승인됨"으로 표시되는 불일치가 생긴다.
export function QuoteStatusForm({ id, currentStatus }: { id: string; currentStatus: string }) {
  const [pending, startTransition] = useTransition();

  if (currentStatus === "accepted") return null;

  return (
    <select
      value={currentStatus}
      disabled={pending}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("status", e.target.value);
        startTransition(() => {
          updateQuoteStatus(formData);
        });
      }}
      className="erp-input"
      style={{ width: "auto" }}
      aria-label="견적 상태 변경"
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
