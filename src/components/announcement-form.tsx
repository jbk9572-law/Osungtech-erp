"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { useFormRedirect } from "@/lib/use-form-redirect";
import { ModalFormSheet } from "@/components/erp/modal-form-sheet";
import { RichTextEditor } from "@/components/rich-text-editor-dynamic";

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
  useFormRedirect(state);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const [content, setContent] = useState(initial?.content ?? "");

  return (
    <ModalFormSheet
      title={initial ? "공지 수정" : "새 공지"}
      tabLabel="공지 내용"
      formAction={formAction}
      state={state}
      pending={pending}
      submitRef={submitRef}
      submitLabel={`F7 ${initial ? "저장" : submitLabel}`}
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="erp-field erp-span-9">
        <label htmlFor="ann-title">제목</label>
        <input id="ann-title" name="title" autoComplete="off" required defaultValue={initial?.title} className="erp-input erp-u-w-full" />
      </div>
      <div className="erp-field erp-span-3">
        <label htmlFor="ann-pinned">고정</label>
        <label className="erp-u-flex erp-u-items-center erp-u-gap-8">
          <input id="ann-pinned" type="checkbox" name="pinned" defaultChecked={initial?.pinned} />
          상단 고정
        </label>
      </div>
      <div className="erp-field erp-span-12">
        <label>내용</label>
        <input type="hidden" name="content" value={content} />
        <RichTextEditor value={content} onChange={setContent} placeholder="내용을 입력하세요..." minHeight={260} />
      </div>
    </ModalFormSheet>
  );
}
