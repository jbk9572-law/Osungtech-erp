"use client";

import { useActionState, useState } from "react";
import { setMaintenanceMode } from "@/app/platform-admin/settings/actions";
import { FormMessage } from "@/components/form-message";

export function MaintenanceModeForm({
  enabled: initialEnabled,
  message: initialMessage,
}: {
  enabled: boolean;
  message: string | null;
}) {
  const [state, formAction, pending] = useActionState(setMaintenanceMode, undefined);
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="enabled"
          value="1"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        점검 모드 켜기 (플랫폼 운영자를 제외한 모든 사용자의 화면 접근을 막습니다)
      </label>
      <div>
        <label htmlFor="maintenance-message" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">
          안내 문구 (점검 중 화면에 그대로 표시됩니다)
        </label>
        <textarea
          id="maintenance-message"
          name="message"
          rows={3}
          defaultValue={initialMessage ?? ""}
          placeholder="예: 9/28(일) 02:00~04:00 시스템 점검이 진행 중입니다. 잠시 후 다시 접속해주세요."
          className="erp-input"
          style={{ width: "100%", height: "auto", padding: "8px", resize: "vertical" }}
        />
      </div>
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary" style={{ alignSelf: "flex-start" }}>
        {pending ? "저장 중..." : "저장"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
