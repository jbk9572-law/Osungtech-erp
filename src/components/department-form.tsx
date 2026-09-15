"use client";

import { useActionState, useRef } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

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
        <select id="dept-parent" name="parent_department_id" className="erp-input w-full" defaultValue={initial?.parentDepartmentId ?? ""}>
          <option value="">없음(최상위)</option>
          {candidates
            .filter((c) => c.id !== initial?.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
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
    </form>
  );
}
