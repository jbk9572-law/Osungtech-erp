"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPlatformPlan } from "@/app/platform-admin/plans/actions";
import { FormMessage } from "@/components/form-message";

// 이름/설명이 둘 다 짧은 한 줄 입력칸으로 나란히 있어서 "이게 제목칸인지
// 설명칸인지" 구분이 안 된다는 지적을 받았다 — 설명은 여러 줄짜리
// textarea로 확실히 구분하고, 짧은 필드(키/이름/가격)만 한 줄에 모은다.
export function CreatePlatformPlanForm() {
  const [state, formAction, pending] = useActionState(createPlatformPlan, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="erp-field">
          <label htmlFor="pp-key">요금제 키(영문)</label>
          <input id="pp-key" name="plan_key" autoComplete="off" required className="erp-input" placeholder="예: basic" />
        </div>
        <div className="erp-field">
          <label htmlFor="pp-name">이름</label>
          <input id="pp-name" name="name" autoComplete="off" required className="erp-input" placeholder="예: 베이직" />
        </div>
        <div className="erp-field">
          <label htmlFor="pp-price">월 가격(원)</label>
          <input
            id="pp-price"
            name="monthly_price"
            type="number"
            min={0}
            step={1000}
            defaultValue={0}
            className="erp-input"
            style={{ width: 120 }}
          />
        </div>
      </div>

      <div className="erp-field">
        <label htmlFor="pp-description">설명 — 고객의 구독/결제 화면에 그대로 보이는 안내 문구</label>
        <textarea
          id="pp-description"
          name="description"
          rows={3}
          className="erp-input w-full"
          style={{ resize: "vertical" }}
          placeholder={"예: DB 저장공간 50MB, 파일 저장소 1GB, 전자세금계산서 100건, 팩스 100건 기본 포함"}
        />
      </div>

      {/* 위 설명은 사람이 읽는 안내 문구일 뿐이라, 실제로 고객사에
          적용할 숫자는 여기 따로 입력한다 — "텍스트 설명만 있고 세팅할
          방법이 없다"는 지적 반영. 빈 칸으로 두면 그 항목은 기본값을
          안 정하는 것으로 저장된다(고객사 상세 > 이용 상태의 "이 요금제
          기본값 적용" 버튼이 이 값을 그대로 복사한다). */}
      <div className="erp-field-grid">
        <div className="erp-field erp-span-3">
          <label htmlFor="pp-db">DB 용량(MB)</label>
          <input id="pp-db" name="included_db_mb" type="number" min={0} className="erp-input" placeholder="예: 50" />
        </div>
        <div className="erp-field erp-span-3">
          <label htmlFor="pp-file">파일 저장소(GB)</label>
          <input id="pp-file" name="included_file_gb" type="number" min={0} className="erp-input" placeholder="예: 1" />
        </div>
        <div className="erp-field erp-span-3">
          <label htmlFor="pp-vendor">외주처 연동 수</label>
          <input id="pp-vendor" name="included_vendor_limit" type="number" min={0} className="erp-input" placeholder="예: 1" />
        </div>
        <div className="erp-field erp-span-3">
          <label htmlFor="pp-email">월 이메일 발송(건)</label>
          <input id="pp-email" name="included_email_quota" type="number" min={0} className="erp-input" placeholder="예: 100" />
        </div>
        <div className="erp-field erp-span-3">
          <label htmlFor="pp-fax">월 팩스 발송(건)</label>
          <input id="pp-fax" name="included_fax_quota" type="number" min={0} className="erp-input" placeholder="예: 100" />
        </div>
        <div className="erp-field erp-span-3">
          <label htmlFor="pp-invoice">월 계산서 발행(건)</label>
          <input id="pp-invoice" name="included_invoice_quota" type="number" min={0} className="erp-input" placeholder="예: 100" />
        </div>
        <div className="erp-field erp-span-3">
          <label htmlFor="pp-alimtalk">월 알림톡/문자 발송(건)</label>
          <input id="pp-alimtalk" name="included_alimtalk_quota" type="number" min={0} className="erp-input" placeholder="예: 0" />
        </div>
      </div>

      <div>
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? "등록 중..." : "등록"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
