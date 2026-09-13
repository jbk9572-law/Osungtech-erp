"use client";

import { deleteAllRacks } from "@/app/(dashboard)/inventory/locations/actions";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";

// 코드 체계가 바뀌는 등(예: 위치코드 단순화) 랙을 하나씩 지우기보다
// 처음부터 다시 만들고 싶을 때 쓰는 전체 삭제 — 되돌릴 수 없고 등록해둔
// 위치별 재고가 전부 사라지는 무거운 동작이라, 다른 삭제 버튼들과 동일하게
// window.confirm 대신 임의 4자리 코드 직접 입력 방식으로 확인한다(자세한
// 안내는 이 버튼을 감싸는 화면의 PageGuide에 이미 있다).
export function DeleteAllRacksButton() {
  return (
    <InlineConfirmDelete
      action={deleteAllRacks}
      hiddenFields={{}}
      warningText="모든 랙과 위치별 재고를 전부 삭제할까요? 되돌릴 수 없습니다."
      triggerLabel="전체 랙 삭제"
    />
  );
}
