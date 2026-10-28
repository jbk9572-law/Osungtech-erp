"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createAddOnProduct } from "@/app/platform-admin/addons/actions";
import { FormMessage } from "@/components/form-message";
import { ADDON_KIND_OPTIONS, addonKindUnit } from "@/lib/addon-kind";

// create-platform-plan-form.tsx와 같은 레이아웃 원칙 — 짧은 필드(키/
// 이름/유형/용량/가격)는 한 줄에, 이 폼은 설명 문구가 따로 없어(애드온은
// 이름 자체가 설명이라는 전제, 예: "팩스 추가 패키지 (+100건)") 그만큼
// 더 짧다.
export function CreateAddOnProductForm() {
  const [state, formAction, pending] = useActionState(createAddOnProduct, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<string>(ADDON_KIND_OPTIONS[0].value);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="erp-field">
          <label htmlFor="ap-key">애드온 키(영문)</label>
          <input id="ap-key" name="key" autoComplete="off" required className="erp-input" placeholder="예: addon_fax_100" />
        </div>
        <div className="erp-field">
          <label htmlFor="ap-name">이름</label>
          <input
            id="ap-name"
            name="name"
            autoComplete="off"
            required
            className="erp-input"
            placeholder="예: 팩스 추가 패키지 (+100건)"
            style={{ width: 220 }}
          />
        </div>
        <div className="erp-field">
          <label htmlFor="ap-kind">적용 유형</label>
          <select
            id="ap-kind"
            name="kind"
            required
            className="erp-select"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {ADDON_KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field">
          <label htmlFor="ap-capacity">제공 용량/건수({addonKindUnit(kind)})</label>
          <input
            id="ap-capacity"
            name="capacity"
            type="number"
            min={1}
            required
            className="erp-input"
            style={{ width: 110 }}
            placeholder="예: 100"
          />
        </div>
        <div className="erp-field">
          <label htmlFor="ap-price">월 가격(원)</label>
          <input
            id="ap-price"
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

      <div>
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? "등록 중..." : "등록"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
