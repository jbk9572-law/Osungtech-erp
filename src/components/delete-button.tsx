"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

const CONFIRM_WORD = "삭제";

// 단순 confirm() 팝업은 Enter 한 번으로 그냥 넘어갈 수 있어, 되돌릴 수
// 없는 삭제 앞에서는 "삭제"를 직접 입력해야 버튼이 눌리는 단계를 둔다
// (상품 일괄삭제와 같은 패턴). F6은 이제 즉시 삭제가 아니라 이 확인
// 입력창을 여는 동작으로 바뀐다.
export function DeleteButton({
  action,
  id,
  confirmMessage = "정말 삭제하시겠습니까?",
  label = "삭제",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  confirmMessage?: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const openRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F6", openRef);
  const confirmMatches = confirmText.trim() === CONFIRM_WORD;

  if (!confirming) {
    return (
      <button
        ref={openRef}
        type="button"
        onClick={() => setConfirming(true)}
        className="erp-btn erp-btn-danger"
      >
        {`F6 ${label}`}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2 rounded-sm border p-2 text-sm"
      style={{ borderColor: "var(--erp-border)", background: "var(--erp-selected)" }}
    >
      <input type="hidden" name="id" value={id} />
      <span style={{ color: "var(--erp-danger)" }}>{confirmMessage}</span>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        확인을 위해 <strong>{CONFIRM_WORD}</strong> 입력
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="erp-input"
          style={{ width: 64, height: 24, padding: "0 6px", fontSize: 11.5 }}
          aria-label={`삭제를 확인하려면 ${CONFIRM_WORD}을 입력하세요`}
          autoFocus
        />
      </label>
      <button
        type="submit"
        disabled={pending || !confirmMatches}
        className="erp-btn erp-btn-danger"
        style={{ minWidth: 0 }}
      >
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 삭제 중...
          </>
        ) : (
          "삭제"
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          setConfirmText("");
        }}
        className="erp-btn"
        style={{ minWidth: 0 }}
      >
        취소
      </button>
      <FormMessage state={state} />
    </form>
  );
}
