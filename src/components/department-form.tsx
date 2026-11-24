"use client";

import { useActionState, useRef, useState } from "react";
import { type FormState } from "@/components/form-message";
import { ModalFormSheet } from "@/components/erp/modal-form-sheet";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { ErpSelect } from "@/components/erp/erp-select";

export function DepartmentForm({
  action,
  submitLabel,
  candidates,
  initial,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  candidates: { id: string; name: string }[];
  initial?: { id?: string; name?: string; parentDepartmentId?: string | null };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [parentDepartmentId, setParentDepartmentId] = useState(initial?.parentDepartmentId ?? "");
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <ModalFormSheet title={initial?.id ? "부서 수정" : "새 부서"} tabLabel={initial?.id ? "부서 수정" : "부서 등록"} formAction={formAction} state={state} pending={pending} submitRef={submitRef} submitLabel={`F7 ${submitLabel}`}>
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="erp-field erp-span-6">
        <label htmlFor="dept-name">부서명</label>
        <input id="dept-name" type="text" name="name" autoComplete="off" defaultValue={initial?.name} className="erp-input erp-u-w-full" required />
      </div>
      <div className="erp-field erp-span-6">
        <label htmlFor="dept-parent">상위 부서 (선택)</label>
        <ErpSelect
          id="dept-parent"
          name="parent_department_id"
          value={parentDepartmentId}
          onChange={setParentDepartmentId}
          options={[
            { value: "", label: "없음(최상위)" },
            ...candidates.filter((c) => c.id !== initial?.id).map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>
    </ModalFormSheet>
  );
}
