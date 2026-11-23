"use client";

import { useActionState, useRef } from "react";
import type { FormState } from "@/components/form-message";
import { ModalFormSheet } from "@/components/erp/modal-form-sheet";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export function WarehouseForm({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <ModalFormSheet title="새 창고" tabLabel="창고 등록" formAction={formAction} state={state} pending={pending} submitRef={submitRef} submitLabel="F7 저장">
      <div className="erp-field erp-span-6">
        <label htmlFor="wh-name">창고명</label>
        <input id="wh-name" type="text" name="name" autoComplete="off" className="erp-input erp-u-w-full" required />
      </div>
      <div className="erp-field erp-span-6">
        <label htmlFor="wh-location">위치 (선택)</label>
        <input id="wh-location" type="text" name="location" autoComplete="off" className="erp-input erp-u-w-full" />
      </div>
    </ModalFormSheet>
  );
}
