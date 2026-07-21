"use client";

import { useTransition } from "react";
import { cancelPriceSchedule } from "@/app/(dashboard)/customers/actions";

export function CancelPriceScheduleButton({ id, customerId }: { id: string; customerId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="erp-btn erp-btn-danger"
      style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11.5 }}
      disabled={pending}
      onClick={() => {
        if (!confirm("이 단가 예약을 취소하시겠습니까?")) return;
        const formData = new FormData();
        formData.set("id", id);
        formData.set("customer_id", customerId);
        startTransition(() => {
          cancelPriceSchedule(undefined, formData);
        });
      }}
    >
      취소
    </button>
  );
}
