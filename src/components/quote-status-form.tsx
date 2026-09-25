"use client";

import { useTransition } from "react";
import { updateQuoteStatus } from "@/app/(dashboard)/quotes/actions";

const STATUS_OPTIONS = [
  { value: "draft", label: "초안" },
  { value: "rejected", label: "거절" },
  { value: "expired", label: "만료" },
];

// "accepted"(승인)는 매출 전환 버튼을 통해서만 되게 하고 여기서는 뺐다 —
// 직접 상태만 바꾸면 실제 매출 없이 "승인됨"으로 표시되는 불일치가 생긴다.
// "sent"(발송)도 여기서 뺐다 — SendQuoteButton(실제 이메일 발송)을 통해서만
// 되게 해서, 메일이 실제로 나가지 않았는데 상태만 "발송됨"으로 표시되는
// 불일치를 막는다.
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
      {currentStatus === "sent" && (
        <option value="sent" disabled>
          발송됨
        </option>
      )}
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
