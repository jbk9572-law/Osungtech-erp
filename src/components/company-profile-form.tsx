"use client";

import { useActionState, useRef, useState } from "react";
import { updateCompanyProfile } from "@/app/(dashboard)/settings/company/actions";
import { FormMessage } from "@/components/form-message";
import { PhoneInputGroup } from "@/components/phone-input-group";
import { PageGuide } from "@/components/erp/page-guide";
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
  office_lat?: number | null;
  office_lng?: number | null;
  office_radius_m?: number;
} | null;

export function CompanyProfileForm({ company }: { company: Company }) {
  const [state, formAction, pending] = useActionState(updateCompanyProfile, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const officeLatRef = useRef<HTMLInputElement>(null);
  const officeLngRef = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  return (
    <form
      action={formAction}
      className="erp-detail-body grid grid-cols-1 gap-4 md:grid-cols-2"
      style={{ border: "1px solid var(--erp-border)", borderRadius: 0 }}
    >
      <div>
        <label htmlFor="cp-name" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">상호명</label>
        <input
          id="cp-name"
          name="name"
          autoComplete="off"
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
          autoComplete="off"
          defaultValue={company?.business_number ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <label htmlFor="cp-rep" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">대표자명</label>
        <input
          id="cp-rep"
          name="representative_name"
          autoComplete="off"
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
          autoComplete="off"
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
          autoComplete="off"
          defaultValue={company?.business_type ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div>
        <label htmlFor="cp-bizitem" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">종목</label>
        <input
          id="cp-bizitem"
          name="business_item"
          autoComplete="off"
          defaultValue={company?.business_item ?? ""}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="cp-address" className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">주소</label>
        <input
          id="cp-address"
          name="address"
          autoComplete="off"
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
          autoComplete="off"
          defaultValue={company?.greeting_message ?? "오늘 하루도 행복하십시요."}
          className="erp-input" style={{ width: "100%" }}
        />
      </div>
      <div className="md:col-span-2" style={{ borderTop: "1px solid var(--erp-border)", paddingTop: 12, marginTop: 4 }}>
        <span className="mb-1 block text-xs font-medium text-[var(--erp-text-muted)]">
          사무실 위치 (근태 GPS 확인 기준)
        </span>
        <PageGuide className="text-[11px]">
          근태 &gt; 출퇴근 체크에서 GPS로 기록한 위치가 이 좌표에서 얼마나 떨어져 있는지 함께
          보여줍니다. 비워두면 위치는 기록만 되고 거리 비교는 하지 않습니다.
        </PageGuide>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="cp-office-lat" className="mb-1 block text-[11px] text-[var(--erp-text-muted)]">
              위도
            </label>
            <input
              ref={officeLatRef}
              id="cp-office-lat"
              name="office_lat"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={company?.office_lat ?? ""}
              className="erp-input"
              style={{ width: 140 }}
            />
          </div>
          <div>
            <label htmlFor="cp-office-lng" className="mb-1 block text-[11px] text-[var(--erp-text-muted)]">
              경도
            </label>
            <input
              ref={officeLngRef}
              id="cp-office-lng"
              name="office_lng"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={company?.office_lng ?? ""}
              className="erp-input"
              style={{ width: 140 }}
            />
          </div>
          <div>
            <label htmlFor="cp-office-radius" className="mb-1 block text-[11px] text-[var(--erp-text-muted)]">
              인정 반경(m)
            </label>
            <input
              id="cp-office-radius"
              name="office_radius_m"
              type="number"
              min={1}
              autoComplete="off"
              defaultValue={company?.office_radius_m ?? 300}
              className="erp-input"
              style={{ width: 100 }}
            />
          </div>
          <button
            type="button"
            className="erp-btn"
            disabled={locating}
            onClick={() => {
              if (!("geolocation" in navigator)) {
                setLocateError("이 브라우저에서는 위치 확인을 지원하지 않습니다.");
                return;
              }
              setLocating(true);
              setLocateError(null);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  if (officeLatRef.current) officeLatRef.current.value = String(pos.coords.latitude);
                  if (officeLngRef.current) officeLngRef.current.value = String(pos.coords.longitude);
                  setLocating(false);
                },
                () => {
                  setLocateError("위치 확인에 실패했습니다. 브라우저 위치 권한을 확인해주세요.");
                  setLocating(false);
                },
                { enableHighAccuracy: true, timeout: 8000 }
              );
            }}
          >
            {locating ? "위치 확인 중..." : "📍 지금 위치를 사무실로 지정"}
          </button>
        </div>
        {locateError && (
          <p className="mt-1 text-[11px]" style={{ color: "var(--erp-danger)" }}>
            {locateError}
          </p>
        )}
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
