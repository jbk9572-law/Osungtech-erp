"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { extractTemplateFields } from "@/lib/document-template";

const CATEGORY_LABELS: Record<string, string> = {
  hr_contract: "인사 · 계약서",
  hr_certificate: "인사 · 증명서",
  approval: "전자결재 서식",
  general: "기타",
};

export function DocumentTemplateForm({
  action,
  submitLabel,
  initial,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  initial?: { id?: string; name?: string; body?: string; category?: string; isActive?: boolean };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  // 저장 안 해도, 지금 입력창 본문 기준으로 어떤 병합필드가 인식되는지
  // 실시간으로 보여준다 — 오타로 필드가 하나 덜 인식되는 걸 저장 전에
  // 바로 알 수 있게.
  const [body, setBody] = useState(initial?.body ?? "");
  const fields = useMemo(() => extractTemplateFields(body), [body]);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="erp-field">
          <label htmlFor="dt-name">양식 이름</label>
          <input id="dt-name" type="text" name="name" autoComplete="off" defaultValue={initial?.name} className="erp-input w-full" required />
        </div>
        <div className="erp-field">
          <label htmlFor="dt-category">분류</label>
          <select id="dt-category" name="category" className="erp-input w-full" defaultValue={initial?.category ?? "general"}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="erp-field">
        <label htmlFor="dt-body">
          본문 — <code>{"{{field_name}}"}</code> 형태로 병합필드를 넣으세요(예: {"{{employee_name}}"})
        </label>
        <textarea
          id="dt-body"
          name="body"
          rows={16}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="erp-input w-full"
          style={{ fontFamily: "monospace", fontSize: 12.5 }}
        />
        <p className="mt-1 text-xs" style={{ color: "var(--erp-text-muted)" }}>
          인식된 병합필드: {fields.length ? fields.map((f) => `{{${f}}}`).join(", ") : "(없음)"}
        </p>
      </div>
      {initial?.id && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" value="1" defaultChecked={initial.isActive ?? true} />
          사용 중(문서 생성 시 선택 가능)
        </label>
      )}
      <div className="flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? "저장 중..." : `F7 ${submitLabel}`}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
