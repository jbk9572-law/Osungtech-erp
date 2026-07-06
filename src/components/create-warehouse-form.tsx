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
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="location"
        placeholder="위치"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 sm:w-32"
      >
        {pending ? "저장 중..." : "추가"}
      </button>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
