"use client";

import { useActionState, useRef } from "react";
import { deleteRack } from "@/app/(dashboard)/inventory/locations/actions";
import { FormMessage } from "@/components/form-message";

export function DeleteRackButton({ rack }: { rack: string }) {
  const [state, formAction, pending] = useActionState(deleteRack, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`${rack}랙과 그 안에 등록된 품목 배치를 전부 삭제할까요?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="rack" value={rack} />
      <button type="submit" disabled={pending} className="erp-btn erp-btn-danger">
        랙 삭제
      </button>
      {/* 실패해도(권한 문제 등) 버튼만 있으면 눌러도 아무 반응이 없는
          것처럼 보였다 — 실제 결과를 항상 화면에 보여준다. */}
      <FormMessage state={state} />
    </form>
  );
}
