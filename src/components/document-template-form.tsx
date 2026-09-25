"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { extractTemplateFields, isServerAutoField, SERVER_AUTO_FIELD_LABELS } from "@/lib/document-template";

const CATEGORY_LABELS: Record<string, string> = {
  hr_contract: "인사 · 계약서",
  hr_certificate: "인사 · 증명서",
  approval: "전자결재 서식",
  official: "공문 서식",
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // {{today}}처럼 사람이 직접 타이핑해도 되지만, 오타 방지 겸 이 화면에
  // "그런 자동 필드가 있다"는 걸 바로 보여주려고 커서 위치에 끼워 넣는
  // 버튼을 둔다 — 문서 생성 화면(generate-document-form.tsx)에서는 이
  // 이름으로 인식된 필드만 입력칸 없이 자동으로 채워진다.
  function insertAutoField(name: string) {
    const el = bodyRef.current;
    const token = `{{${name}}}`;
    if (!el) {
      setBody((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  }

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
        <div className="mb-1 flex flex-wrap items-center gap-1">
          <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
            자동 필드 삽입:
          </span>
          {Object.entries(SERVER_AUTO_FIELD_LABELS).map(([name, label]) => (
            <button
              key={name}
              type="button"
              onClick={() => insertAutoField(name)}
              className="erp-btn"
              style={{ minWidth: 0, padding: "2px 8px", fontSize: 11 }}
            >
              {label}
            </button>
          ))}
        </div>
        <textarea
          id="dt-body"
          name="body"
          ref={bodyRef}
          rows={16}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="erp-input w-full"
          style={{ fontFamily: "monospace", fontSize: 12.5 }}
        />
        <p className="mt-1 text-xs" style={{ color: "var(--erp-text-muted)" }}>
          인식된 병합필드:{" "}
          {fields.length
            ? fields.map((f) => `{{${f}}}${isServerAutoField(f) ? "(자동)" : ""}`).join(", ")
            : "(없음)"}
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
