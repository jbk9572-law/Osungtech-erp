"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useFormRedirect } from "@/lib/use-form-redirect";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { OrgChartApproverPicker, type PickedPerson } from "@/components/org-chart-approver-picker";
import type { OrgDepartmentNode } from "@/lib/org-chart";
import { extractTemplateFields, renderTemplate } from "@/lib/document-template";

type TemplateOption = { id: string; name: string; body: string };
export type ApprovalLinePresetOption = { id: string; name: string; approverIds: string[]; referenceIds: string[] };

export function ApprovalDocumentForm({
  action,
  draftAction,
  orgTree,
  templates,
  presets,
  matrixByTemplate,
  profileNameById,
  initialDraft,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  draftAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
  orgTree: OrgDepartmentNode[];
  templates: TemplateOption[];
  presets: ApprovalLinePresetOption[];
  matrixByTemplate: Record<string, string>;
  profileNameById: Record<string, string>;
  initialDraft?: { id: string; title: string; content: string; approverIds: string[]; referenceIds: string[] };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [draftState, draftFormAction, draftPending] = useActionState(draftAction, undefined);
  useFormRedirect(state);
  useFormRedirect(draftState);

  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  function toPicked(ids: string[]): PickedPerson[] {
    return ids.map((id) => ({ id, name: profileNameById[id] ?? "구성원" }));
  }

  const [approvers, setApprovers] = useState<PickedPerson[]>(() => toPicked(initialDraft?.approverIds ?? []));
  const [references, setReferences] = useState<PickedPerson[]>(() => toPicked(initialDraft?.referenceIds ?? []));
  const [templateId, setTemplateId] = useState("");
  const [presetId, setPresetId] = useState("");
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [content, setContent] = useState(initialDraft?.content ?? "");
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const templateFields = selectedTemplate ? extractTemplateFields(selectedTemplate.body) : [];

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setApprovers(toPicked(preset.approverIds));
    setReferences(toPicked(preset.referenceIds));
  }

  function applyTemplate(t: TemplateOption | undefined) {
    if (!t) return;
    setTitle((prev) => prev || t.name);
    const fields = extractTemplateFields(t.body);
    const values: Record<string, string> = {};
    for (const f of fields) values[f] = "";
    setTemplateValues(values);
    setContent(fields.length === 0 ? t.body : renderTemplate(t.body, values));

    // 결재매트릭스에 이 양식용 규칙이 있으면 결재선을 자동으로 제안한다
    // — 강제 고정이 아니라 제안일 뿐이라, 아래 org-chart picker에서
    // 사람이 여전히 자유롭게 바꿀 수 있다.
    const matchedPresetId = matrixByTemplate[t.id];
    if (matchedPresetId) applyPreset(matchedPresetId);
  }

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="grid grid-cols-1 gap-3">
      {initialDraft && <input type="hidden" name="draft_id" value={initialDraft.id} />}
      {approvers.map((a) => (
        <input key={a.id} type="hidden" name="approver_id" value={a.id} />
      ))}
      {references.map((r) => (
        <input key={r.id} type="hidden" name="reference_id" value={r.id} />
      ))}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
        {presets.length > 0 && (
          <div className="erp-field">
            <label htmlFor="ad-preset">저장된 결재선 불러오기</label>
            <select id="ad-preset" className="erp-input w-full" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
              <option value="">선택 안 함</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
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

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" formAction={draftFormAction} disabled={pending || draftPending} className="erp-btn">
          {draftPending ? "저장 중..." : "임시저장"}
        </button>
        <button ref={submitRef} type="submit" disabled={pending || draftPending || approvers.length === 0} className="erp-btn erp-btn-primary">
          {pending ? "상신 중..." : "F7 상신"}
        </button>
        <FormMessage state={state} />
        <FormMessage state={draftState} />
      </div>
    </form>
  );
}
