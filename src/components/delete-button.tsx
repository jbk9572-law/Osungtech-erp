"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

const CONFIRM_VALUE = "1";

// 단순 confirm() 팝업은 Enter 한 번으로 그냥 넘어갈 수 있어, 되돌릴 수
// 없는 삭제 앞에서는 직접 입력해야 버튼이 눌리는 단계를 둔다. 일괄삭제
// 확인란("선택 건수 입력")과 같은 숫자 입력 방식으로 맞춘다 — 단건
// 삭제는 항상 1건이니 "1"을 입력하게 한다(다른 단어를 쓰면 사용자가
// 일괄삭제에서 익힌 습관과 어긋나 혼동한다). F6은 이제 즉시 삭제가
// 아니라 이 확인 입력창을 여는 동작으로 바뀐다.
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
  const confirmMatches = confirmText.trim() === CONFIRM_VALUE;

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
        확인을 위해 <strong>{CONFIRM_VALUE}</strong> 입력
        <input
          type="text"
          inputMode="numeric"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="erp-input"
          style={{ width: 48, height: 24, padding: "0 6px", fontSize: 11.5 }}
          aria-label={`삭제를 확인하려면 ${CONFIRM_VALUE}을 입력하세요`}
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
