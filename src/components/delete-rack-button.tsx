"use client";

import { deleteRack } from "@/app/(dashboard)/inventory/locations/actions";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";

// 되돌릴 수 없는 삭제라 다른 삭제 버튼들(DeleteButton/BulkDeleteBar 등)과
// 동일하게 임의 4자리 코드 직접 입력 방식으로 확인한다 — window.confirm은
// Enter 한 번이면 그냥 넘어갈 수 있어 이런 무거운 동작에는 약하다.
export function DeleteRackButton({ rack }: { rack: string }) {
  return (
    <InlineConfirmDelete
      action={deleteRack}
      hiddenFields={{ rack }}
      warningText={`${rack}랙과 그 안에 등록된 품목 배치를 전부 삭제할까요?`}
      triggerLabel="랙 삭제"
    />
  );
}
