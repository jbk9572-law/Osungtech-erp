"use client";

import { useActionState } from "react";
import { updatePlatformPlan, deletePlatformPlan } from "@/app/platform-admin/plans/actions";
import { FormMessage } from "@/components/form-message";
import { DeleteButton } from "@/components/delete-button";

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

  return (
    <tr>
      <td style={{ color: "var(--erp-text-muted)" }}>{planKey}</td>
      <td style={{ padding: "6px 8px" }}>
        {/* DeleteButton은 자체 <form>(확인코드 입력 시)을 갖고 있어, 이
            저장용 form 안에 두면 <form> 중첩이 되므로 밖에 나란히 둔다. */}
        <div className="flex flex-wrap items-center gap-2">
          <form action={formAction} id={`plan-form-${id}`} className="contents">
            <input type="hidden" name="id" value={id} />
            <input
              name="name"
              defaultValue={name}
              required
              autoComplete="off"
              className="erp-input"
              style={{ width: 120 }}
              aria-label="요금제 이름"
            />
            <input
              type="number"
              name="monthly_price"
              defaultValue={monthlyPrice}
              min={0}
              step={1000}
              className="erp-input"
              style={{ width: 110 }}
              aria-label="월 가격"
            />
            <input
              name="description"
              defaultValue={description ?? ""}
              autoComplete="off"
              className="erp-input"
              style={{ flex: "1 1 160px", minWidth: 120 }}
              aria-label="설명"
            />
            <label className="flex items-center gap-1 text-xs" style={{ color: "var(--erp-text-muted)" }}>
              <input type="checkbox" name="is_active" value="1" defaultChecked={isActive} />
              노출
            </label>
            <button type="submit" className="erp-btn" disabled={pending}>
              {pending ? "저장 중..." : "저장"}
            </button>
          </form>
          <DeleteButton action={deletePlatformPlan} id={id} confirmMessage={`"${name}" 요금제를 삭제하시겠습니까?`} />
        </div>
        <FormMessage state={state} />
      </td>
    </tr>
  );
}
