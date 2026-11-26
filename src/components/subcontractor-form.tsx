"use client";

import { useActionState, useRef } from "react";
import type { FormState } from "@/components/form-message";
import { ModalFormSheet } from "@/components/erp/modal-form-sheet";
import { PhoneInputGroup } from "@/components/phone-input-group";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export type SubcontractorFormInitial = {
  name?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  memo?: string | null;
  default_unit_cost?: number | string | null;
};

export function SubcontractorForm({
  action,
  initial,
  submitLabel = "저장",
  idFieldValue,
  embedded,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: SubcontractorFormInitial;
  submitLabel?: string;
  idFieldValue?: string;
  /** 상세 화면 안에 끼워 넣을 때(모달 틀 없이) */
  embedded?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <ModalFormSheet embedded={embedded} title={idFieldValue ? "하청업체 수정" : "새 하청업체"} tabLabel="하청업체 등록" formAction={formAction} state={state} pending={pending} submitRef={submitRef} submitLabel={`F7 ${submitLabel}`}>
      {idFieldValue && <input type="hidden" name="id" value={idFieldValue} />}
      <div className="erp-field erp-span-6">
        <label htmlFor="sc-name">업체명</label>
        <input id="sc-name" name="name" autoComplete="off" required defaultValue={initial?.name ?? ""} className="erp-input erp-u-w-full" />
      </div>
      <div className="erp-field erp-span-6">
        <label htmlFor="sc-contact">담당자</label>
        <input id="sc-contact" name="contact_name" autoComplete="off" defaultValue={initial?.contact_name ?? ""} className="erp-input erp-u-w-full" />
      </div>
      <div className="erp-field erp-span-6">
        <label>연락처</label>
        <PhoneInputGroup namePrefix="phone" defaultValue={initial?.phone} />
      </div>
      <div className="erp-field erp-span-6">
        <label htmlFor="sc-default-unit-cost">기본 가공비 단가 (원, 선택)</label>
        <input
          id="sc-default-unit-cost"
          name="default_unit_cost"
          type="number"
          min="0"
          step="1"
          autoComplete="off"
          defaultValue={initial?.default_unit_cost ?? ""}
          className="erp-input erp-u-w-full"
        />
      </div>
      <div className="erp-field erp-span-12">
        <label htmlFor="sc-memo">비고 (맡기는 공정, 특이사항 등)</label>
        <textarea id="sc-memo" name="memo" defaultValue={initial?.memo ?? ""} rows={2} className="erp-input erp-textarea-compact erp-u-w-full" />
      </div>
    </ModalFormSheet>
  );
}
