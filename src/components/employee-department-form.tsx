"use client";

import { useActionState, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { ErpSelect } from "@/components/erp/erp-select";

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
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(departmentId ?? "");

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <ErpSelect
        name="department_id"
        style={{ width: 160 }}
        value={selectedDepartmentId}
        onChange={setSelectedDepartmentId}
        options={[{ value: "", label: "미배정" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
      />
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
