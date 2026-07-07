"use client";

import { useActionState, useRef } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";
import { PhoneInputGroup } from "@/components/phone-input-group";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export type PartnerFormInitial = {
  name?: string | null;
  business_number?: string | null;
  representative_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  document_type?: "출고증" | "명세표" | null;
};

export function PartnerForm({
  action,
  initial,
  showDocumentType = false,
  submitLabel = "저장",
  idFieldValue,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: PartnerFormInitial;
  showDocumentType?: boolean;
  submitLabel?: string;
  idFieldValue?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {idFieldValue && <input type="hidden" name="id" value={idFieldValue} />}
      <input
        name="name"
        placeholder="상호명"
        required
        defaultValue={initial?.name ?? ""}
        className="erp-input"
      />
      <input
        name="business_number"
        placeholder="사업자등록번호"
        defaultValue={initial?.business_number ?? ""}
        className="erp-input"
      />
      <input
        name="representative_name"
        placeholder="대표자명"
        defaultValue={initial?.representative_name ?? ""}
        className="erp-input"
      />
      <input
        name="contact_name"
        placeholder="담당자"
        defaultValue={initial?.contact_name ?? ""}
        className="erp-input"
      />
      <input
        name="email"
        placeholder="이메일"
        type="email"
        defaultValue={initial?.email ?? ""}
        className="erp-input"
      />
      <PhoneInputGroup namePrefix="phone" defaultValue={initial?.phone} />
      <input
        name="address"
        placeholder="주소"
        defaultValue={initial?.address ?? ""}
        className="erp-input sm:col-span-3"
      />
      <textarea
        name="notes"
        placeholder="비고 / 특이사항"
        defaultValue={initial?.notes ?? ""}
        rows={2}
        className="erp-input sm:col-span-3"
        style={{ height: "auto", paddingTop: 6, paddingBottom: 6 }}
      />
      {showDocumentType && (
        <div className="erp-field">
          <label>발행 문서</label>
          <select
            name="document_type"
            defaultValue={initial?.document_type ?? "명세표"}
            className="erp-select"
          >
            <option value="명세표">명세표 (단가 포함)</option>
            <option value="출고증">출고증 (단가 없음)</option>
          </select>
        </div>
      )}
      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary sm:col-span-3">
        {pending ? "저장 중..." : `F7 ${submitLabel}`}
      </button>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
