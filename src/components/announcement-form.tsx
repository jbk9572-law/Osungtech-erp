"use client";

import { useActionState, useRef } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export function AnnouncementForm({
  action,
  submitLabel = "등록",
  initial,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel?: string;
  initial?: { id: string; title: string; content: string; pinned: boolean };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input
        name="title"
        placeholder="제목"
        required
        defaultValue={initial?.title}
        className="erp-input md:col-span-3"
      />
      <label className="md:col-span-3 flex items-center gap-2 text-sm" style={{ color: "var(--erp-text)" }}>
        <input type="checkbox" name="pinned" defaultChecked={initial?.pinned} />
        상단 고정
      </label>
      <textarea
        name="content"
        placeholder="내용"
        rows={10}
        defaultValue={initial?.content}
        className="erp-input md:col-span-3"
        style={{ resize: "vertical" }}
      />
      <div className="md:col-span-3 flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 저장 중...
            </>
          ) : (
            `F7 ${submitLabel}`
          )}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
