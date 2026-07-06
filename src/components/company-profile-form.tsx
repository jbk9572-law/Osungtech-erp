"use client";

import { useActionState } from "react";
import { updateCompanyProfile } from "@/app/(dashboard)/settings/company/actions";
import { FormMessage } from "@/components/form-message";

type Company = {
  name: string;
  business_number: string | null;
  representative_name: string | null;
  phone: string | null;
  fax_number: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  business_type: string | null;
  business_item: string | null;
  address: string | null;
  email: string | null;
  greeting_message: string | null;
} | null;

export function CompanyProfileForm({ company }: { company: Company }) {
  const [state, formAction, pending] = useActionState(updateCompanyProfile, undefined);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">상호명</label>
        <input
          name="name"
          defaultValue={company?.name ?? ""}
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">사업자등록번호</label>
        <input
          name="business_number"
          defaultValue={company?.business_number ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">대표자명</label>
        <input
          name="representative_name"
          defaultValue={company?.representative_name ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">연락처</label>
        <input
          name="phone"
          defaultValue={company?.phone ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">팩스번호</label>
        <input
          name="fax_number"
          defaultValue={company?.fax_number ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">담당자 성명</label>
        <input
          name="manager_name"
          defaultValue={company?.manager_name ?? ""}
          placeholder="예: 강신조 차장님"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">담당자 연락처</label>
        <input
          name="manager_phone"
          defaultValue={company?.manager_phone ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">업태</label>
        <input
          name="business_type"
          defaultValue={company?.business_type ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">종목</label>
        <input
          name="business_item"
          defaultValue={company?.business_item ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-700">주소</label>
        <input
          name="address"
          defaultValue={company?.address ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">이메일</label>
        <input
          name="email"
          type="email"
          defaultValue={company?.email ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          명세표 하단 인사말
        </label>
        <input
          name="greeting_message"
          defaultValue={company?.greeting_message ?? "오늘 하루도 행복하십시요."}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 sm:col-span-2 sm:w-32"
      >
        {pending ? "저장 중..." : "저장"}
      </button>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
