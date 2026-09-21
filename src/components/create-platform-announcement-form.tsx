"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPlatformAnnouncement } from "@/app/platform-admin/announcements/actions";
import { FormMessage } from "@/components/form-message";

export function CreatePlatformAnnouncementForm() {
  const [state, formAction, pending] = useActionState(createPlatformAnnouncement, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="erp-field">
        <label htmlFor="pa-title">제목</label>
        <input id="pa-title" name="title" autoComplete="off" required className="erp-input" />
      </div>
      <div className="erp-field">
        <label htmlFor="pa-content">내용</label>
        <textarea id="pa-content" name="content" rows={3} className="erp-input" />
      </div>
      <div>
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? "등록 중..." : "등록"}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
