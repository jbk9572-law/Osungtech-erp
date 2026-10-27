"use client";

import { useActionState } from "react";
import { updatePlatformPlan, deletePlatformPlan } from "@/app/platform-admin/plans/actions";
import { FormMessage } from "@/components/form-message";
import { DeleteButton } from "@/components/delete-button";

// 예전엔 이름/가격/설명/노출/저장/삭제를 <table> 안 <td> 하나에
// flex-wrap으로 욱여넣고, 입력칸 구분을 화면에 안 보이는 aria-label에만
// 의존했다 — "이게 제목칸인지 설명칸인지" 구분이 안 된다는 지적을
// 받았다. 매출/재고처럼 수십~수백 행을 훑어야 하는 데이터그리드가
// 아니라(개발헌법 2번 — 그리드가 필요 없으면 각지게 두지 않는다) 몇 건
// 안 되는 카탈로그라, 고객사 목록(page.tsx)·통계 화면과 같은 그룹웨어
// 카드 피드(.erp-card-feed, .erp-comm-shell 스코프에서 둥근 모서리+옅은
// 그림자)로 맞췄다 — 칸마다 라벨을 붙여 "칸=필드" 원칙은 그대로 지키되
// 표 칸 대신 라벨 있는 카드 안 블록으로 구현한다.
//
// DeleteButton이 확인 단계에서 자기 자신의 <form>을 렌더링하므로, 이
// 카드 전체를 <form>으로 감싸면 <form> 중첩(무효한 HTML)이 된다. 보이지
// 않는 <form> 하나를 카드 안에 두고 나머지 입력칸들은 HTML5의
// form="id" 속성으로 그 폼에 연결해 DOM 중첩 없이 제출을 묶는다.
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
        <div className="erp-field" style={{ flex: "0 0 90px" }}>
          <label>키</label>
          <span
            style={{
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              fontSize: "var(--erp-font-base)",
              color: "var(--erp-text-muted)",
              paddingTop: 6,
            }}
          >
            {planKey}
          </span>
        </div>
        <div className="erp-field" style={{ flex: "1 1 160px", minWidth: 140 }}>
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
        <div className="erp-field" style={{ flex: "2 1 260px", minWidth: 220 }}>
          <label htmlFor={`${formId}-description`}>설명(고객에게 보이는 안내 문구)</label>
          <input
            id={`${formId}-description`}
            name="description"
            form={formId}
            defaultValue={description ?? ""}
            autoComplete="off"
            placeholder="예: DB 50MB, 파일 1GB, 전자세금계산서 100건 포함"
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
          <DeleteButton action={deletePlatformPlan} id={id} confirmMessage={`"${name}" 요금제를 삭제하시겠습니까?`} />
        </div>
      </div>
    </div>
  );
}
