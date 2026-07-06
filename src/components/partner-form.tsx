"use client";

import { useActionState } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";

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

function splitPhone(phone?: string | null) {
  const parts = (phone ?? "").split("-");
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

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
  const [phone1, phone2, phone3] = splitPhone(initial?.phone);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {idFieldValue && <input type="hidden" name="id" value={idFieldValue} />}
      <input
        name="name"
        placeholder="상호명"
        required
        defaultValue={initial?.name ?? ""}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="business_number"
        placeholder="사업자등록번호"
        defaultValue={initial?.business_number ?? ""}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="representative_name"
        placeholder="대표자명"
        defaultValue={initial?.representative_name ?? ""}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="contact_name"
        placeholder="담당자"
        defaultValue={initial?.contact_name ?? ""}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="email"
        placeholder="이메일"
        type="email"
        defaultValue={initial?.email ?? ""}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-1">
        <input
          name="phone1"
          placeholder="010"
          defaultValue={phone1}
          maxLength={4}
          className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-center text-sm"
        />
        <span className="text-gray-400">-</span>
        <input
          name="phone2"
          placeholder="1234"
          defaultValue={phone2}
          maxLength={4}
          className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-center text-sm"
        />
        <span className="text-gray-400">-</span>
        <input
          name="phone3"
          placeholder="5678"
          defaultValue={phone3}
          maxLength={4}
          className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-center text-sm"
        />
      </div>
      <input
        name="address"
        placeholder="주소"
        defaultValue={initial?.address ?? ""}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-3"
      />
      <textarea
        name="notes"
        placeholder="비고 / 특이사항"
        defaultValue={initial?.notes ?? ""}
        rows={2}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-3"
      />
      {showDocumentType && (
        <div>
          <label className="mb-1 block text-xs text-gray-500">발행 문서</label>
          <select
            name="document_type"
            defaultValue={initial?.document_type ?? "명세표"}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="명세표">명세표 (단가 포함)</option>
            <option value="출고증">출고증 (단가 없음)</option>
          </select>
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 sm:col-span-3 sm:w-32"
      >
        {pending ? "저장 중..." : submitLabel}
      </button>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
