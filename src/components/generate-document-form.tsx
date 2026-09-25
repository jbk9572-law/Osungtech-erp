"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { extractTemplateFields, isServerAutoField, SERVER_AUTO_FIELD_LABELS } from "@/lib/document-template";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { PageGuide } from "@/components/erp/page-guide";

type TemplateOption = { id: string; name: string; body: string };
type EmployeeOption = { id: string; full_name: string | null };

const FIELD_LABELS: Record<string, string> = {
  company_name: "회사명",
  employee_name: "직원명",
};

export function GenerateDocumentForm({
  action,
  templates,
  employees,
  companyName,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  templates: TemplateOption[];
  employees: EmployeeOption[];
  companyName: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [subjectUserId, setSubjectUserId] = useState("");
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);
  // {{today}}, {{author_name}} 같은 서버 자동 필드는 사람이 채울 값이
  // 아니라 문서 생성 시점에 서버가 직접 넣는다(createDocument 참고) —
  // 입력칸 목록에서 아예 빼서 "이건 안 채워도 되는 필드"임을 굳이
  // 안내하지 않아도 자연스럽게 드러나게 한다.
  const allFields = useMemo(() => (selectedTemplate ? extractTemplateFields(selectedTemplate.body) : []), [selectedTemplate]);
  const fields = useMemo(() => allFields.filter((f) => !isServerAutoField(f)), [allFields]);
  const autoFields = useMemo(() => allFields.filter(isServerAutoField), [allFields]);

  function applyAutoFill(subjectId: string, fieldList: string[]) {
    const employeeName = employees.find((e) => e.id === subjectId)?.full_name ?? "";
    const next: Record<string, string> = {};
    for (const f of fieldList) {
      if (f === "company_name") next[f] = companyName ?? "";
      else if (f === "employee_name") next[f] = employeeName;
      else next[f] = "";
    }
    setValues(next);
  }

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="template_id" value={templateId} />
      <input type="hidden" name="subject_user_id" value={subjectUserId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="erp-field">
          <label htmlFor="gd-template">양식</label>
          <select
            id="gd-template"
            className="erp-input w-full"
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              const t = templates.find((x) => x.id === e.target.value);
              applyAutoFill(subjectUserId, t ? extractTemplateFields(t.body).filter((f) => !isServerAutoField(f)) : []);
            }}
            required
          >
            <option value="" disabled>
              선택
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field">
          <label htmlFor="gd-subject">대상 직원 (선택)</label>
          <select
            id="gd-subject"
            className="erp-input w-full"
            value={subjectUserId}
            onChange={(e) => {
              setSubjectUserId(e.target.value);
              applyAutoFill(e.target.value, fields);
            }}
          >
            <option value="">해당 없음</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name || "구성원"}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field">
          <label htmlFor="gd-title">제목</label>
          <input
            id="gd-title"
            type="text"
            name="title"
            autoComplete="off"
            value={title || selectedTemplate?.name || ""}
            onChange={(e) => setTitle(e.target.value)}
            className="erp-input w-full"
            required
          />
        </div>
      </div>

      {autoFields.length > 0 && (
        <PageGuide className="mb-0">
          {autoFields.map((f) => SERVER_AUTO_FIELD_LABELS[f]).join(", ")}은(는) 문서를 생성하는 지금
          시점 기준으로 자동으로 채워집니다.
        </PageGuide>
      )}
      {fields.length === 0 ? (
        selectedTemplate &&
        autoFields.length === 0 && (
          <p className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
            이 양식에는 채울 필드가 없습니다.
          </p>
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {fields.map((f) => (
            <div key={f} className="erp-field">
              <label htmlFor={`gd-field-${f}`}>{FIELD_LABELS[f] ?? f}</label>
              <input
                id={`gd-field-${f}`}
                type="text"
                autoComplete="off"
                value={values[f] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f]: e.target.value }))}
                className="erp-input w-full"
              />
              <input type="hidden" name="field_name" value={f} />
              <input type="hidden" name="field_value" value={values[f] ?? ""} />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending || !templateId} className="erp-btn erp-btn-primary">
          {pending ? "생성 중..." : "F7 문서 생성"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
