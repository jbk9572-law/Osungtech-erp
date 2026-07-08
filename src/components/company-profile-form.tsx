"use client";

import { useActionState, useRef } from "react";
import { updateCompanyProfile } from "@/app/(dashboard)/settings/company/actions";
import { FormMessage } from "@/components/form-message";
import { PhoneInputGroup } from "@/components/phone-input-group";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

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
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form
      action={formAction}
      className="erp-detail-body grid grid-cols-1 gap-4 sm:grid-cols-2"
      style={{ border: "1px solid var(--erp-border)", borderRadius: 2 }}
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6b7280]">상호명</label>
        <input
          name="name"
          defaultValue={company?.name ?? ""}
          required
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6b7280]">사업자등록번호</label>
        <input
          name="business_number"
          defaultValue={company?.business_number ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6b7280]">대표자명</label>
        <input
          name="representative_name"
          defaultValue={company?.representative_name ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6b7280]">연락처</label>
        <PhoneInputGroup namePrefix="phone" defaultValue={company?.phone} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6b7280]">팩스번호</label>
        <PhoneInputGroup namePrefix="fax" defaultValue={company?.fax_number} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6b7280]">담당자 성명</label>
        <input
          name="manager_name"
          defaultValue={company?.manager_name ?? ""}
          placeholder="예: 강신조 차장님"
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6b7280]">담당자 연락처</label>
        <PhoneInputGroup namePrefix="mgrphone" defaultValue={company?.manager_phone} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6b7280]">업태</label>
        <input
          name="business_type"
          defaultValue={company?.business_type ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6b7280]">종목</label>
        <input
          name="business_item"
          defaultValue={company?.business_item ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-[#6b7280]">주소</label>
        <input
          name="address"
          defaultValue={company?.address ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6b7280]">이메일</label>
        <input
          name="email"
          type="email"
          defaultValue={company?.email ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-[#6b7280]">
          명세표 하단 인사말
        </label>
        <input
          name="greeting_message"
          defaultValue={company?.greeting_message ?? "오늘 하루도 행복하십시요."}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary sm:col-span-2">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          "F7 저장"
        )}
      </button>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
