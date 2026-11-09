"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/components/form-message";
import { ErpSelect } from "@/components/erp/erp-select";

// 결재매트릭스 화면의 "결재양식 → 결재선" 연결 셀렉트. 설정 > 기능 관리의
// FeatureToggle과 같은 낙관적 업데이트 패턴(바꾸자마자 화면에 반영하고,
// 저장이 실패하면 원래 값으로 되돌린다)을 그대로 따른다 — 화면마다
// "바꾸면 바로 저장" 동작 방식이 다르면 헷갈리므로 하나로 통일한다.
export function ApprovalMatrixRuleSelect({
  templateId,
  presetId: serverPresetId,
  presets,
  action,
}: {
  templateId: string;
  presetId: string;
  presets: { id: string; name: string }[];
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [prevPresetId, setPrevPresetId] = useState(serverPresetId);
  const [presetId, setPresetId] = useState(serverPresetId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (serverPresetId !== prevPresetId) {
    setPrevPresetId(serverPresetId);
    setPresetId(serverPresetId);
  }

  return (
    <div className="flex items-center gap-2">
      <ErpSelect
        style={{ height: 28, fontSize: 12 }}
        value={presetId}
        disabled={pending}
        onChange={(next) => {
          const previous = presetId;
          setPresetId(next);
          setError(null);
          const formData = new FormData();
          formData.set("template_id", templateId);
          formData.set("preset_id", next);
          startTransition(async () => {
            const result = await action(undefined, formData);
            if (result?.error) {
              setPresetId(previous);
              setError(result.error);
            }
          });
        }}
        options={[{ value: "", label: "연결 안 함" }, ...presets.map((p) => ({ value: p.id, label: p.name }))]}
      />
      {error && (
        <span className="text-xs" style={{ color: "var(--erp-danger)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
