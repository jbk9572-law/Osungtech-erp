"use client";

import { useActionState, useRef } from "react";
import { deleteAllRacks } from "@/app/(dashboard)/inventory/locations/actions";
import { FormMessage } from "@/components/form-message";

// 코드 체계가 바뀌는 등(예: 위치코드 단순화) 랙을 하나씩 지우기보다
// 처음부터 다시 만들고 싶을 때 쓰는 전체 삭제 — 되돌릴 수 없고 등록해둔
// 위치별 재고가 전부 사라지는 무거운 동작이라, 확인 문구에 정확히 뭐가
// 없어지는지 적어두고 한 번 더 물어본다(다른 삭제 버튼들과 동일하게
// window.confirm 방식).
export function DeleteAllRacksButton() {
  const [state, formAction, pending] = useActionState(deleteAllRacks, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "모든 랙과 그 안에 등록된 위치별 재고를 전부 삭제할까요?\n\n" +
              "· 창고 전체 재고(재고현황)에는 영향 없습니다.\n" +
              "· 랙별로 등록해둔 품목 배치는 전부 사라지며 되돌릴 수 없습니다.\n" +
              "· 다시 만들려면 랙을 새로 추가하고 위치별 재고를 다시 등록해야 합니다.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" disabled={pending} className="erp-btn erp-btn-danger">
        {pending ? "삭제 중..." : "전체 랙 삭제"}
      </button>
      <div className="mt-2">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
