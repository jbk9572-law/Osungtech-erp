"use client";

import { useActionState, useState } from "react";
import { updateAddOnProduct, deleteAddOnProduct } from "@/app/platform-admin/addons/actions";
import { FormMessage } from "@/components/form-message";
import { DeleteButton } from "@/components/delete-button";
import { ADDON_KIND_OPTIONS, addonKindUnit } from "@/lib/addon-kind";

// platform-plan-row.tsx와 완전히 같은 패턴(카드 안에 숨긴 <form>을 두고
// 나머지 입력칸은 form="id" 속성으로 연결) — 요금제 카탈로그와 애드온
// 카탈로그는 "관리자가 등록/수정/삭제하는 카드형 목록"이라는 점에서
// 같은 화면 종류라 마크업을 새로 짜지 않는다(개발헌법 3번).
export function AddOnProductRow({
  id,
  addonKey,
  name,
  kind,
  capacity,
  monthlyPrice,
  isActive,
}: {
  id: string;
  addonKey: string;
  name: string;
  kind: string;
  capacity: number;
  monthlyPrice: number;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateAddOnProduct, undefined);
  const [selectedKind, setSelectedKind] = useState(kind);
  const formId = `addon-form-${id}`;

  return (
    <div
      style={{
        background: "var(--erp-panel)",
        border: "1px solid var(--erp-comm-border)",
        borderRadius: "var(--erp-comm-radius-row)",
        boxShadow: "var(--erp-comm-shadow-row)",
        padding: "14px 18px",
        flex: "0 0 auto",
      }}
    >
      <form id={formId} action={formAction}>
        <input type="hidden" name="id" value={id} />
      </form>

      <div className="flex flex-wrap items-start gap-4">
        <div className="erp-field" style={{ flex: "0 0 140px" }}>
          <label>키</label>
          <span
            style={{
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              fontSize: "var(--erp-font-base)",
              color: "var(--erp-text-muted)",
              paddingTop: 6,
            }}
          >
            {addonKey}
          </span>
        </div>
        <div className="erp-field" style={{ flex: "1 1 200px", minWidth: 160 }}>
          <label htmlFor={`${formId}-name`}>이름</label>
          <input
            id={`${formId}-name`}
            name="name"
            form={formId}
            defaultValue={name}
            required
            autoComplete="off"
            className="erp-input w-full"
          />
        </div>
        <div className="erp-field" style={{ flex: "0 0 140px" }}>
          <label htmlFor={`${formId}-kind`}>적용 유형</label>
          <select
            id={`${formId}-kind`}
            name="kind"
            form={formId}
            required
            className="erp-select w-full"
            value={selectedKind}
            onChange={(e) => setSelectedKind(e.target.value)}
          >
            {ADDON_KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field" style={{ flex: "0 0 130px" }}>
          <label htmlFor={`${formId}-capacity`}>제공 용량/건수({addonKindUnit(selectedKind)})</label>
          <input
            id={`${formId}-capacity`}
            type="number"
            name="capacity"
            form={formId}
            defaultValue={capacity}
            min={1}
            className="erp-input w-full"
          />
        </div>
        <div className="erp-field" style={{ flex: "0 0 130px" }}>
          <label htmlFor={`${formId}-price`}>월 가격(원)</label>
          <input
            id={`${formId}-price`}
            type="number"
            name="monthly_price"
            form={formId}
            defaultValue={monthlyPrice}
            min={0}
            step={1000}
            className="erp-input w-full"
          />
        </div>
        <div className="erp-field" style={{ flex: "0 0 auto" }}>
          <label htmlFor={`${formId}-active`}>노출</label>
          <input
            id={`${formId}-active`}
            type="checkbox"
            name="is_active"
            value="1"
            form={formId}
            defaultChecked={isActive}
            style={{ marginTop: 6 }}
          />
        </div>
      </div>

      <div
        className="flex items-center justify-between"
        style={{ marginTop: "var(--erp-space-3)", paddingTop: "var(--erp-space-2)", borderTop: "1px solid var(--erp-divider)" }}
      >
        <FormMessage state={state} />
        <div className="flex items-center gap-1">
          <button type="submit" form={formId} className="erp-btn" disabled={pending} style={{ minWidth: 0 }}>
            {pending ? "저장 중..." : "저장"}
          </button>
          <DeleteButton action={deleteAddOnProduct} id={id} confirmMessage={`"${name}" 애드온을 삭제하시겠습니까?`} />
        </div>
      </div>
    </div>
  );
}
