"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { OrgChartApproverPicker, type PickedPerson } from "@/components/org-chart-approver-picker";
import type { OrgDepartmentNode } from "@/lib/org-chart";
import { extractTemplateFields, renderTemplate } from "@/lib/document-template";

type TemplateOption = { id: string; name: string; body: string };

export function ApprovalDocumentForm({
  action,
  orgTree,
  templates,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  orgTree: OrgDepartmentNode[];
  templates: TemplateOption[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const [approvers, setApprovers] = useState<PickedPerson[]>([]);
  const [references, setReferences] = useState<PickedPerson[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const templateFields = selectedTemplate ? extractTemplateFields(selectedTemplate.body) : [];

  function applyTemplate(t: TemplateOption | undefined) {
    if (!t) return;
    setTitle((prev) => prev || t.name);
    const fields = extractTemplateFields(t.body);
    const values: Record<string, string> = {};
    for (const f of fields) values[f] = "";
    setTemplateValues(values);
    setContent(fields.length === 0 ? t.body : renderTemplate(t.body, values));
  }

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="grid grid-cols-1 gap-3">
      {approvers.map((a) => (
        <input key={a.id} type="hidden" name="approver_id" value={a.id} />
      ))}
      {references.map((r) => (
        <input key={r.id} type="hidden" name="reference_id" value={r.id} />
      ))}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="erp-field">
          <label htmlFor="ad-template">양식 (선택)</label>
          <select
            id="ad-template"
            className="erp-input w-full"
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              applyTemplate(templates.find((t) => t.id === e.target.value));
            }}
          >
            <option value="">자유양식</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field">
          <label htmlFor="ad-title">제목</label>
          <input
            id="ad-title"
            type="text"
            name="title"
            autoComplete="off"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="erp-input w-full"
            required
          />
        </div>
      </div>

      {templateFields.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {templateFields.map((f) => (
            <div key={f} className="erp-field">
              <label htmlFor={`ad-tf-${f}`}>{f}</label>
              <input
                id={`ad-tf-${f}`}
                type="text"
                autoComplete="off"
                value={templateValues[f] ?? ""}
                onChange={(e) => {
                  const nextValues = { ...templateValues, [f]: e.target.value };
                  setTemplateValues(nextValues);
                  if (selectedTemplate) setContent(renderTemplate(selectedTemplate.body, nextValues));
                }}
                className="erp-input w-full"
              />
            </div>
          ))}
        </div>
      )}

      <div className="erp-field">
        <label htmlFor="ad-content">내용</label>
        <textarea id="ad-content" name="content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} className="erp-input w-full" />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold" style={{ color: "var(--erp-text)" }}>
          결재선 · 참조자 선택
        </p>
        <OrgChartApproverPicker
          tree={orgTree}
          approvers={approvers}
          references={references}
          onChangeApprovers={setApprovers}
          onChangeReferences={setReferences}
        />
      </div>

      <div className="flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending || approvers.length === 0} className="erp-btn erp-btn-primary">
          {pending ? "상신 중..." : "F7 상신"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
