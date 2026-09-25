"use client";

import { useActionState, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useFormRedirect } from "@/lib/use-form-redirect";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { extractTemplateFields, isServerAutoField, renderTemplate, SERVER_AUTO_FIELD_LABELS } from "@/lib/document-template";
import { PageGuide } from "@/components/erp/page-guide";

type TemplateOption = { id: string; name: string; body: string };
type ProfileOption = { id: string; name: string };

type RecipientRow = {
  key: number;
  kind: "external" | "internal";
  name: string;
  email: string;
  userId: string | null;
};

const DISCLOSURE_LABELS: Record<string, string> = { public: "공개", partial: "부분공개", private: "비공개" };
const RETENTION_LABELS: Record<string, string> = {
  "1": "1년",
  "3": "3년",
  "5": "5년",
  "10": "10년",
  "30": "30년",
  permanent: "영구",
};

export function OfficialDocumentForm({
  action,
  templates,
  profiles,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  templates: TemplateOption[];
  profiles: ProfileOption[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  useFormRedirect(state);

  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [internalOnly, setInternalOnly] = useState(false);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [nextKey, setNextKey] = useState(0);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const allFields = selectedTemplate ? extractTemplateFields(selectedTemplate.body) : [];
  const editableFields = allFields.filter((f) => !isServerAutoField(f));
  const autoFields = allFields.filter(isServerAutoField);

  function applyTemplate(t: TemplateOption | undefined) {
    if (!t) return;
    setTitle((prev) => prev || t.name);
    const fields = extractTemplateFields(t.body);
    const values: Record<string, string> = {};
    for (const f of fields) values[f] = "";
    setTemplateValues(values);
    setBody(fields.length === 0 ? t.body : renderTemplate(t.body, values));
  }

  function addExternalRecipient() {
    setRecipients((prev) => [...prev, { key: nextKey, kind: "external", name: "", email: "", userId: null }]);
    setNextKey((k) => k + 1);
  }
  function addInternalRecipient() {
    const first = profiles[0];
    if (!first) return;
    setRecipients((prev) => [...prev, { key: nextKey, kind: "internal", name: first.name, email: "", userId: first.id }]);
    setNextKey((k) => k + 1);
  }
  function updateRecipient(key: number, patch: Partial<RecipientRow>) {
    setRecipients((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRecipient(key: number) {
    setRecipients((prev) => prev.filter((r) => r.key !== key));
  }

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="grid grid-cols-1 gap-3">
      {recipients.map((r) => (
        <span key={r.key}>
          <input type="hidden" name="recipient_kind" value={r.kind} />
          <input type="hidden" name="recipient_name" value={r.name} />
          <input type="hidden" name="recipient_email" value={r.email} />
          <input type="hidden" name="recipient_user_id" value={r.userId ?? ""} />
        </span>
      ))}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="erp-field">
          <label htmlFor="od-template">양식 (선택)</label>
          <select
            id="od-template"
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
          <input type="hidden" name="template_id" value={templateId} />
        </div>
        <div className="erp-field">
          <label htmlFor="od-title">제목</label>
          <input
            id="od-title"
            type="text"
            name="title"
            autoComplete="off"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="erp-input w-full"
            required
          />
        </div>
        <div className="erp-field">
          <label htmlFor="od-effective-date">시행일자 (선택 — 비우면 발송일)</label>
          <input id="od-effective-date" type="date" name="effective_date" className="erp-input w-full" />
        </div>
      </div>

      {editableFields.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {editableFields.map((f) => (
            <div key={f} className="erp-field">
              <label htmlFor={`od-tf-${f}`}>{f}</label>
              <input
                id={`od-tf-${f}`}
                type="text"
                autoComplete="off"
                value={templateValues[f] ?? ""}
                onChange={(e) => {
                  const nextValues = { ...templateValues, [f]: e.target.value };
                  setTemplateValues(nextValues);
                  if (selectedTemplate) setBody(renderTemplate(selectedTemplate.body, nextValues));
                }}
                className="erp-input w-full"
              />
            </div>
          ))}
        </div>
      )}
      {autoFields.length > 0 && (
        <PageGuide className="mb-0">
          {autoFields.map((f) => SERVER_AUTO_FIELD_LABELS[f]).join(", ")}은(는) 결재가 끝나 문서번호가
          부여되는 시점 기준으로 자동으로 채워집니다.
        </PageGuide>
      )}

      <div className="erp-field">
        <label htmlFor="od-body">본문</label>
        <textarea
          id="od-body"
          name="body"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="erp-input w-full"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="erp-field">
          <label htmlFor="od-disclosure">공개구분</label>
          <select id="od-disclosure" name="disclosure" className="erp-input w-full" defaultValue="public">
            {Object.entries(DISCLOSURE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field">
          <label htmlFor="od-retention">보존연한</label>
          <select id="od-retention" name="retention" className="erp-input w-full" defaultValue="5">
            {Object.entries(RETENTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field">
          <label htmlFor="od-visibility">사내 열람범위</label>
          <select id="od-visibility" name="visibility_scope" className="erp-input w-full" defaultValue="related">
            <option value="related">관련자만(작성자·결재선·수신처)</option>
            <option value="all">전체 직원(발송·종결 후 공개)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="internal_only"
            value="1"
            checked={internalOnly}
            onChange={(e) => setInternalOnly(e.target.checked)}
          />
          사내 공문(외부 발송 없음)
        </label>
      </div>

      {!internalOnly && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: "var(--erp-text)" }}>
              수신처
            </p>
            <div className="flex gap-1">
              <button type="button" onClick={addExternalRecipient} className="erp-btn" style={{ minWidth: 0, height: 26, padding: "0 8px", fontSize: 11.5 }}>
                + 외부 수신처
              </button>
              <button type="button" onClick={addInternalRecipient} className="erp-btn" style={{ minWidth: 0, height: 26, padding: "0 8px", fontSize: 11.5 }} disabled={profiles.length === 0}>
                + 사내 수신처
              </button>
            </div>
          </div>
          {recipients.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
              수신처를 1곳 이상 추가해주세요.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recipients.map((r) => (
                <div key={r.key} className="flex items-center gap-2">
                  <span className="text-[10.5px]" style={{ color: "var(--erp-text-muted)", width: 40 }}>
                    {r.kind === "external" ? "외부" : "사내"}
                  </span>
                  {r.kind === "external" ? (
                    <>
                      <input
                        type="text"
                        placeholder="기관/거래처명"
                        value={r.name}
                        onChange={(e) => updateRecipient(r.key, { name: e.target.value })}
                        className="erp-input"
                        style={{ width: 200 }}
                      />
                      <input
                        type="email"
                        placeholder="이메일(없으면 직접 발송 처리)"
                        value={r.email}
                        onChange={(e) => updateRecipient(r.key, { email: e.target.value })}
                        className="erp-input"
                        style={{ width: 240 }}
                      />
                    </>
                  ) : (
                    <select
                      value={r.userId ?? ""}
                      onChange={(e) => {
                        const p = profiles.find((x) => x.id === e.target.value);
                        updateRecipient(r.key, { userId: p?.id ?? null, name: p?.name ?? "" });
                      }}
                      className="erp-input"
                      style={{ width: 200 }}
                    >
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button type="button" onClick={() => removeRecipient(r.key)} className="erp-btn" style={{ minWidth: 0, height: 26, padding: "0 8px" }}>
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? "저장 중..." : "작성 저장(임시저장)"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
