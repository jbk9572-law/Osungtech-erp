"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

export function EmployeeDepartmentForm({
  action,
  userId,
  departmentId,
  positionTitle,
  departments,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  userId: string;
  departmentId: string | null;
  positionTitle: string | null;
  departments: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <select name="department_id" className="erp-input" style={{ width: 160 }} defaultValue={departmentId ?? ""}>
        <option value="">미배정</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <input
        type="text"
        name="position_title"
        autoComplete="off"
        placeholder="직급/직책"
        defaultValue={positionTitle ?? ""}
        className="erp-input"
        style={{ width: 120 }}
      />
      <button type="submit" disabled={pending} className="erp-btn" style={{ minWidth: 0, height: 28, padding: "0 10px" }}>
        {pending ? "저장 중..." : "저장"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
