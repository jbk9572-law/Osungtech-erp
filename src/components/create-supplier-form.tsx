"use client";

import { useActionState } from "react";
import { createSupplier } from "@/app/(dashboard)/suppliers/actions";
import { FormMessage } from "@/components/form-message";

export function CreateSupplierForm() {
  const [state, formAction, pending] = useActionState(createSupplier, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <input
        name="name"
        placeholder="업체명"
        required
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="contact_name"
        placeholder="담당자"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="email"
        placeholder="이메일"
        type="email"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="phone"
        placeholder="연락처"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 sm:col-span-4 sm:w-32"
      >
        {pending ? "저장 중..." : "추가"}
      </button>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
