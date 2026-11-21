"use client";

import { useActionState, useState, type ReactNode } from "react";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import type { FormState } from "@/components/form-message";

// 체크박스 다중 선택 + 일괄삭제 상태·확인 바를 한 곳에서 — 카드형 목록(SplitListBulkSelect)과 표 목록(PartyListA)이 같이 쓴다.
// 화면은 행마다 체크박스를 그리고 toggle만 부르면 되고, 확인 바(bar)는 선택이 있을 때만 값이 있다.
export function useBulkDelete(
  action: (state: FormState, formData: FormData) => Promise<FormState>,
  rows: { id: string; label: string }[],
  warningText: string,
): { selected: Set<string>; toggle: (id: string) => void; bar: ReactNode } {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setSelected(new Set());
      setConfirmText("");
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmText("");
  }

  const names = rows.filter((r) => selected.has(r.id)).map((r) => r.label);
  const namePreview = names.length > 3 ? `${names.slice(0, 3).join(", ")} 외 ${names.length - 3}건` : names.join(", ");

  const bar =
    selected.size > 0 ? (
      <div className="erp-u-m-8">
        <BulkDeleteBar
          formAction={formAction}
          pending={pending}
          state={state}
          selectedIds={[...selected]}
          namePreview={namePreview}
          warningText={warningText}
          confirmText={confirmText}
          onConfirmTextChange={setConfirmText}
        />
      </div>
    ) : null;

  return { selected, toggle, bar };
}
