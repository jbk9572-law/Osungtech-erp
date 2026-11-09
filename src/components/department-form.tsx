"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { KeyboardHintBar } from "@/components/erp/keyboard-hint-bar";
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
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="erp-field">
        <label htmlFor="dept-name">부서명</label>
        <input id="dept-name" type="text" name="name" autoComplete="off" defaultValue={initial?.name} className="erp-input w-full" required />
      </div>
      <div className="erp-field">
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
      <div className="erp-field">
        <label aria-hidden="true">&nbsp;</label>
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary w-full">
          {pending ? "저장 중..." : `F7 ${submitLabel}`}
        </button>
      </div>
      <div className="md:col-span-3">
        <FormMessage state={state} />
      </div>
      <KeyboardHintBar items={[{ key: "F7", label: "저장" }]} />
    </form>
  );
}
