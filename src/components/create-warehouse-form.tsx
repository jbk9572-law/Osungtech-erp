"use client";

import { useActionState } from "react";
import { createWarehouse } from "@/app/(dashboard)/warehouses/actions";
import { FormMessage } from "@/components/form-message";

export function CreateWarehouseForm() {
  const [state, formAction, pending] = useActionState(createWarehouse, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <input
        name="name"
        placeholder="창고명"
        required
        className="erp-input"
      />
      <input
        name="location"
        placeholder="위치"
        className="erp-input"
      />
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? "저장 중..." : "F7 추가"}
      </button>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
