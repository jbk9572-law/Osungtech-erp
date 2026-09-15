"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/components/form-message";

// 설정 > 기능 관리 화면의 켜기/끄기 스위치. OptimisticCheckbox와 비슷한
// 낙관적 업데이트+실패 시 되돌리기 구조지만, 그쪽은 "행 id + 필드명"
// 조합이라 "기능 키(feature_key) + 켤지 끌지" 조합인 여기에는 그대로
// 안 맞아 따로 만들었다.
export function FeatureToggle({
  featureKey,
  enabled: serverEnabled,
  action,
}: {
  featureKey: string;
  enabled: boolean;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [prevEnabled, setPrevEnabled] = useState(serverEnabled);
  const [enabled, setEnabled] = useState(serverEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (serverEnabled !== prevEnabled) {
    setPrevEnabled(serverEnabled);
    setEnabled(serverEnabled);
  }

  return (
    <label className="flex items-center gap-2" style={{ cursor: pending ? "wait" : "pointer" }}>
      <input
        type="checkbox"
        checked={enabled}
        disabled={pending}
        aria-label={`${featureKey} 기능 사용`}
        onChange={() => {
          const next = !enabled;
          const previous = enabled;
          setEnabled(next);
          setError(null);
          const formData = new FormData();
          formData.set("feature_key", featureKey);
          formData.set("enabled", next ? "1" : "0");
          startTransition(async () => {
            const result = await action(undefined, formData);
            if (result?.error) {
              setEnabled(previous);
              setError(result.error);
            }
          });
        }}
      />
      <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
        {enabled ? "사용" : "미사용"}
      </span>
      {error && <span className="text-xs" style={{ color: "var(--erp-danger)" }}>{error}</span>}
    </label>
  );
}
