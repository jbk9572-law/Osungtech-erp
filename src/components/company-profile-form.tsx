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
      className="erp-detail-body grid grid-cols-1 gap-4 md:grid-cols-2"
      style={{ border: "1px solid var(--erp-border)", borderRadius: 2 }}
    >
      <div>
        <label htmlFor="cp-name" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">상호명</label>
        <input
          id="cp-name"
          name="name"
          defaultValue={company?.name ?? ""}
          required
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <label htmlFor="cp-bizno" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">사업자등록번호</label>
        <input
          id="cp-bizno"
          name="business_number"
          defaultValue={company?.business_number ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <label htmlFor="cp-rep" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">대표자명</label>
        <input
          id="cp-rep"
          name="representative_name"
          defaultValue={company?.representative_name ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">연락처</span>
        <PhoneInputGroup namePrefix="phone" defaultValue={company?.phone} />
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">팩스번호</span>
        <PhoneInputGroup namePrefix="fax" defaultValue={company?.fax_number} />
      </div>
      <div>
        <label htmlFor="cp-manager-name" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">담당자 성명</label>
        <input
          id="cp-manager-name"
          name="manager_name"
          defaultValue={company?.manager_name ?? ""}
          placeholder="예: 강신조 차장님"
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">담당자 연락처</span>
        <PhoneInputGroup namePrefix="mgrphone" defaultValue={company?.manager_phone} />
      </div>
      <div>
        <label htmlFor="cp-biztype" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">업태</label>
        <input
          id="cp-biztype"
          name="business_type"
          defaultValue={company?.business_type ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <label htmlFor="cp-bizitem" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">종목</label>
        <input
          id="cp-bizitem"
          name="business_item"
          defaultValue={company?.business_item ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="cp-address" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">주소</label>
        <input
          id="cp-address"
          name="address"
          defaultValue={company?.address ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <label htmlFor="cp-email" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">이메일</label>
        <input
          id="cp-email"
          name="email"
          type="email"
          defaultValue={company?.email ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="cp-greeting" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">
          명세표 하단 인사말
        </label>
        <input
          id="cp-greeting"
          name="greeting_message"
          defaultValue={company?.greeting_message ?? "오늘 하루도 행복하십시요."}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary md:col-span-2">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          "F7 저장"
        )}
      </button>
      <div className="md:col-span-2">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
