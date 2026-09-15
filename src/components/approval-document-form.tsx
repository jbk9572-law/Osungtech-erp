"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

type ProfileOption = { id: string; full_name: string | null };

// 기안서 작성 폼 — 결재선은 반드시 순서가 있어야 하므로(1번 승인자가
// 승인해야 2번 승인자 차례가 온다) select 여러 개를 화면에 보이는 순서
// 그대로 배열로 관리한다. 폼 제출 시 같은 name="approver_id"로 여러 개
// 보내면 브라우저가 DOM 순서 그대로 담아 보내므로, 그 순서를 그대로
// step_order로 쓴다(submit_approval_document RPC).
export function ApprovalDocumentForm({
  action,
  approvers,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  approvers: ProfileOption[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const [steps, setSteps] = useState<string[]>([""]);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3">
      <div className="erp-field">
        <label htmlFor="ad-title">제목</label>
        <input id="ad-title" type="text" name="title" autoComplete="off" className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label htmlFor="ad-content">내용</label>
        <textarea id="ad-content" name="content" rows={8} className="erp-input w-full" />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold" style={{ color: "var(--erp-text)" }}>
          결재선(순서대로 승인)
        </p>
        <div className="flex flex-col gap-2">
          {steps.map((value, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs" style={{ width: 20, color: "var(--erp-text-muted)" }}>
                {idx + 1}
              </span>
              <select
                name="approver_id"
                className="erp-input"
                style={{ maxWidth: 260 }}
                value={value}
                onChange={(e) =>
                  setSteps((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                }
                required
              >
                <option value="" disabled>
                  선택
                </option>
                {approvers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || "구성원"}
                  </option>
                ))}
              </select>
              {steps.length > 1 && (
                <button
                  type="button"
                  className="erp-btn erp-btn-danger"
                  style={{ minWidth: 0, height: 28, padding: "2px 10px" }}
                  onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="erp-btn"
          style={{ marginTop: 8 }}
          onClick={() => setSteps((prev) => [...prev, ""])}
        >
          + 결재자 추가
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 상신 중...
            </>
          ) : (
            "F7 상신"
          )}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
