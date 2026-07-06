"use client";

import { useActionState } from "react";
import { createCustomer } from "@/app/(dashboard)/customers/actions";
import { FormMessage } from "@/components/form-message";

export function CreateCustomerForm() {
  const [state, formAction, pending] = useActionState(createCustomer, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <input
        name="name"
        placeholder="거래처명"
        required
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="business_number"
        placeholder="사업자등록번호"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="representative_name"
        placeholder="대표자명"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="contact_name"
        placeholder="담당자"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="phone"
        placeholder="연락처"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="email"
        placeholder="이메일"
        type="email"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="address"
        placeholder="주소"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-3"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 sm:col-span-3 sm:w-32"
      >
        {pending ? "저장 중..." : "추가"}
      </button>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
