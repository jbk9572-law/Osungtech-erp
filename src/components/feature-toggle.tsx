"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/components/form-message";

// 설정 > 기능 관리 화면의 켜기/끄기 스위치. OptimisticCheckbox와 비슷한
// 낙관적 업데이트+실패 시 되돌리기 구조지만, 그쪽은 "행 id + 필드명"
// 조합이라 "기능 키(feature_key) + 켤지 끌지" 조합인 여기에는 그대로
// 안 맞아 따로 만들었다.
export function FeatureToggle({
  featureKey,
  label,
  enabled: serverEnabled,
  action,
}: {
  featureKey: string;
  // 세부 메뉴 항목 토글처럼 featureKey 자체가 href라 화면 낭독기용
  // 문구로는 부적절할 때, 사람이 읽을 라벨을 따로 넘긴다(없으면 기존처럼
  // featureKey를 그대로 쓴다).
  label?: string;
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
    <div className="flex items-center gap-2">
      <label className="erp-switch">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          aria-label={`${label ?? featureKey} 기능 사용`}
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
        <span className="erp-switch-track" />
        <span className="erp-switch-knob" />
      </label>
      <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
        {enabled ? "사용" : "미사용"}
      </span>
      {error && <span className="text-xs" style={{ color: "var(--erp-danger)" }}>{error}</span>}
    </div>
  );
}
