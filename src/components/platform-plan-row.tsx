"use client";

import { useActionState } from "react";
import { updatePlatformPlan, deletePlatformPlan } from "@/app/platform-admin/plans/actions";
import { FormMessage } from "@/components/form-message";
import { DeleteButton } from "@/components/delete-button";

// 예전엔 이름/가격/설명/노출/저장/삭제를 전부 <td> 하나에 flex-wrap으로
// 욱여넣고, 입력칸 구분을 화면에 안 보이는 aria-label에만 의존했다 —
// 그래서 "이게 제목칸인지 설명칸인지" 구분이 안 된다는 지적을 받았다.
// 표 형태 화면의 기본 원칙(칸 하나 = 필드 하나, 맨 위 헤더가 그 칸의
// 이름)으로 되돌려서, 칸 위치 자체가 라벨 역할을 하게 한다(다른
// erp-grid 화면들과 같은 방식).
//
// <form>은 HTML 테이블 구조상(tr의 자식은 td/th만 허용) 여러 <td>에
// 걸쳐 감쌀 수 없어서, 보이지 않는 <form> 하나를 첫 칸 안에 두고 나머지
// 입력칸들은 HTML5의 form="id" 속성으로 그 폼에 연결한다 — DOM 중첩과
// 무관하게 제출이 묶인다.
export function PlatformPlanRow({
  id,
  planKey,
  name,
  monthlyPrice,
  description,
  isActive,
}: {
  id: string;
  planKey: string;
  name: string;
  monthlyPrice: number;
  description: string | null;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState(updatePlatformPlan, undefined);
  const formId = `plan-form-${id}`;

  return (
    <tr>
      <td style={{ color: "var(--erp-text-muted)" }}>
        {planKey}
        <form id={formId} action={formAction}>
          <input type="hidden" name="id" value={id} />
        </form>
      </td>
      <td>
        <input name="name" form={formId} defaultValue={name} required autoComplete="off" className="erp-input w-full" />
      </td>
      <td>
        <input
          type="number"
          name="monthly_price"
          form={formId}
          defaultValue={monthlyPrice}
          min={0}
          step={1000}
          className="erp-input w-full"
        />
      </td>
      <td>
        <input
          name="description"
          form={formId}
          defaultValue={description ?? ""}
          autoComplete="off"
          placeholder="예: DB 50MB, 파일 1GB, 전자세금계산서 100건 포함"
          className="erp-input w-full"
        />
      </td>
      <td style={{ textAlign: "center" }}>
        <input type="checkbox" name="is_active" value="1" form={formId} defaultChecked={isActive} aria-label="노출" />
      </td>
      <td>
        <div className="flex items-center gap-1">
          <button type="submit" form={formId} className="erp-btn" disabled={pending} style={{ minWidth: 0 }}>
            {pending ? "저장 중..." : "저장"}
          </button>
          <DeleteButton action={deletePlatformPlan} id={id} confirmMessage={`"${name}" 요금제를 삭제하시겠습니까?`} />
        </div>
        <FormMessage state={state} />
      </td>
    </tr>
  );
}
