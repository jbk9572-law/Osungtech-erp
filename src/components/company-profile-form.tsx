"use client";

import { useActionState, useRef, useState } from "react";
import { updateCompanyProfile } from "@/app/(dashboard)/settings/company/actions";
import { FormMessage } from "@/components/form-message";
import { PhoneInputGroup } from "@/components/phone-input-group";
import { SettingsPage, SettingsSaveBar, SettingsSection } from "@/components/erp/settings-section";
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
    <form action={formAction}>
      <SettingsPage>
        <SettingsSection title="기본 정보" hint="거래명세표의 공급자 정보로 인쇄됩니다">
          <div className="erp-field erp-span-6">
            <label htmlFor="cp-name">상호명</label>
            <input id="cp-name" name="name" autoComplete="off" defaultValue={company?.name ?? ""} required className="erp-input" />
          </div>
          <div className="erp-field erp-span-3">
            <label htmlFor="cp-rep">대표자명</label>
            <input id="cp-rep" name="representative_name" autoComplete="off" defaultValue={company?.representative_name ?? ""} className="erp-input" />
          </div>
          <div className="erp-field erp-span-3">
            <label htmlFor="cp-bizno">사업자등록번호</label>
            <input id="cp-bizno" name="business_number" autoComplete="off" defaultValue={company?.business_number ?? ""} className="erp-input" />
          </div>
          <div className="erp-field erp-span-3">
            <label htmlFor="cp-biztype">업태</label>
            <input id="cp-biztype" name="business_type" autoComplete="off" defaultValue={company?.business_type ?? ""} className="erp-input" />
          </div>
          <div className="erp-field erp-span-3">
            <label htmlFor="cp-bizitem">종목</label>
            <input id="cp-bizitem" name="business_item" autoComplete="off" defaultValue={company?.business_item ?? ""} className="erp-input" />
          </div>
          <div className="erp-field erp-span-3">
            <span className="erp-field-label">연락처</span>
            <PhoneInputGroup namePrefix="phone" defaultValue={company?.phone} />
          </div>
          <div className="erp-field erp-span-3">
            <span className="erp-field-label">팩스번호</span>
            <PhoneInputGroup namePrefix="fax" defaultValue={company?.fax_number} />
          </div>
          <div className="erp-field erp-span-12">
            <label htmlFor="cp-address">주소</label>
            <input id="cp-address" name="address" autoComplete="off" defaultValue={company?.address ?? ""} className="erp-input" />
          </div>
        </SettingsSection>

        <SettingsSection title="연락·발행" hint="명세표 하단과 담당자 표시에 쓰입니다">
          <div className="erp-field erp-span-6">
            <label htmlFor="cp-email">이메일</label>
            <input id="cp-email" name="email" type="email" defaultValue={company?.email ?? ""} className="erp-input" />
          </div>
          <div className="erp-field erp-span-3">
            <label htmlFor="cp-manager-name">담당자 성명</label>
            <input id="cp-manager-name" name="manager_name" autoComplete="off" defaultValue={company?.manager_name ?? ""} placeholder="예: 강신조 차장님" className="erp-input" />
          </div>
          <div className="erp-field erp-span-3">
            <span className="erp-field-label">담당자 연락처</span>
            <PhoneInputGroup namePrefix="mgrphone" defaultValue={company?.manager_phone} />
          </div>
          <div className="erp-field erp-span-12">
            <label htmlFor="cp-greeting">명세표 하단 인사말</label>
            <input id="cp-greeting" name="greeting_message" autoComplete="off" defaultValue={company?.greeting_message ?? "오늘 하루도 행복하십시요."} className="erp-input" />
          </div>
        </SettingsSection>

        <SettingsSection title="사무실 위치" hint="근태 > 출퇴근 체크의 GPS 기록이 이 좌표에서 얼마나 떨어졌는지 보여줍니다. 비워두면 거리 비교는 하지 않습니다.">
          <div className="erp-field erp-span-3">
            <label htmlFor="cp-office-lat">위도</label>
            <input ref={officeLatRef} id="cp-office-lat" name="office_lat" type="text" inputMode="decimal" autoComplete="off" defaultValue={company?.office_lat ?? ""} className="erp-input" />
          </div>
          <div className="erp-field erp-span-3">
            <label htmlFor="cp-office-lng">경도</label>
            <input ref={officeLngRef} id="cp-office-lng" name="office_lng" type="text" inputMode="decimal" autoComplete="off" defaultValue={company?.office_lng ?? ""} className="erp-input" />
          </div>
          <div className="erp-field erp-span-2">
            <label htmlFor="cp-office-radius">인정 반경(m)</label>
            <input id="cp-office-radius" name="office_radius_m" type="number" min={1} autoComplete="off" defaultValue={company?.office_radius_m ?? 300} className="erp-input" />
          </div>
          <div className="erp-field erp-span-4">
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
            {locateError && <p className="erp-u-danger">{locateError}</p>}
          </div>
        </SettingsSection>

        <SettingsSaveBar>
          <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
            {pending ? (
              <>
                <span className="erp-spinner" aria-hidden /> 저장 중...
              </>
            ) : (
              "F7 저장"
            )}
          </button>
          <FormMessage state={state} />
        </SettingsSaveBar>
      </SettingsPage>
    </form>
  );
}
