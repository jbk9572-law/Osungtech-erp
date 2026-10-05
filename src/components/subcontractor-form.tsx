"use client";

import { useActionState, useRef } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";
import { PhoneInputGroup } from "@/components/phone-input-group";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { KeyboardHintBar } from "@/components/erp/keyboard-hint-bar";

export type SubcontractorFormInitial = {
  name?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  memo?: string | null;
};

export function SubcontractorForm({
  action,
  initial,
  submitLabel = "저장",
  idFieldValue,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: SubcontractorFormInitial;
  submitLabel?: string;
  idFieldValue?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {idFieldValue && <input type="hidden" name="id" value={idFieldValue} />}
      <input
        name="name"
        autoComplete="off"
        placeholder="업체명"
        aria-label="업체명"
        required
        defaultValue={initial?.name ?? ""}
        className="erp-input"
      />
      <input
        name="contact_name"
        autoComplete="off"
        placeholder="담당자"
        aria-label="담당자"
        defaultValue={initial?.contact_name ?? ""}
        className="erp-input"
      />
      <PhoneInputGroup namePrefix="phone" defaultValue={initial?.phone} />
      <textarea
        name="memo"
        placeholder="비고 (맡기는 공정, 특이사항 등)"
        aria-label="비고"
        defaultValue={initial?.memo ?? ""}
        rows={2}
        className="erp-input erp-textarea-compact md:col-span-2"
      />
      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary md:col-span-2">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          `F7 ${submitLabel}`
        )}
      </button>
      <div className="md:col-span-2">
        <FormMessage state={state} />
      </div>
      <KeyboardHintBar items={[{ key: "F7", label: "저장" }]} />
    </form>
  );
}
