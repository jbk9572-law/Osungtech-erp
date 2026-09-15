"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

export function ClockInOutPanel({
  clockedIn,
  clockedOut,
  clockInTime,
  clockOutTime,
  clockInAction,
  clockOutAction,
}: {
  clockedIn: boolean;
  clockedOut: boolean;
  clockInTime: string | null;
  clockOutTime: string | null;
  clockInAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
  clockOutAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [inState, inFormAction, inPending] = useActionState(clockInAction, undefined);
  const [outState, outFormAction, outPending] = useActionState(clockOutAction, undefined);

  return (
    <div className="erp-kpi-row" style={{ marginBottom: 12 }}>
      <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
          출근
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{clockInTime ?? "-"}</div>
        <form action={inFormAction}>
          <button type="submit" disabled={clockedIn || inPending} className="erp-btn erp-btn-primary" style={{ width: "100%" }}>
            {inPending ? "처리 중..." : "출근하기"}
          </button>
        </form>
        <FormMessage state={inState} />
      </div>
      <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
          퇴근
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{clockOutTime ?? "-"}</div>
        <form action={outFormAction}>
          <button
            type="submit"
            disabled={!clockedIn || clockedOut || outPending}
            className="erp-btn erp-btn-dark"
            style={{ width: "100%" }}
          >
            {outPending ? "처리 중..." : "퇴근하기"}
          </button>
        </form>
        <FormMessage state={outState} />
      </div>
    </div>
  );
}
