"use client";

import { useActionState, useRef } from "react";
import { deleteRack } from "@/app/(dashboard)/inventory/locations/actions";

export function DeleteRackButton({ rack }: { rack: string }) {
  const [, formAction, pending] = useActionState(deleteRack, undefined);
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
    </form>
  );
}
