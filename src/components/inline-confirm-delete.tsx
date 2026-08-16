"use client";

import { useActionState, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { FormMessage, type FormState } from "@/components/form-message";
import { generateConfirmCode } from "@/lib/confirm-code";

// 좁은 표 칸(영수증 썸네일 X버튼, 수금/지급 내역 삭제 등)에서는 확인 폼을
// 그 자리에 펼치면 표 레이아웃이 깨지므로, 버튼 위치를 기준으로 포털에
// 작은 확인 패널을 띄운다. PartySearchSelect의 위치 계산 방식과 동일.
// 확인 입력은 DeleteButton/BulkDeleteBar와 같은 임의 4자리 코드 방식으로
// 맞춘다 — 화면마다 확인 방식이 달라 헷갈리지 않게.
export function InlineConfirmDelete({
  action,
  hiddenFields,
  warningText,
  triggerLabel = "삭제",
  triggerClassName = "erp-btn erp-btn-danger",
  triggerStyle,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  hiddenFields: Record<string, string>;
  warningText: string;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [code, setCode] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const confirmMatches = confirmText.trim() === code;

  // 삭제 성공 시 패널을 닫는다 — 다른 폼들과 동일한 state identity 비교 패턴.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setOpen(false);
      setConfirmText("");
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          const r = triggerRef.current?.getBoundingClientRect();
          if (r) setRect({ top: r.bottom + 4, left: r.left });
          setCode(generateConfirmCode());
          setOpen(true);
        }}
        className={triggerClassName}
        style={triggerStyle}
      >
        {triggerLabel}
      </button>
      {open &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="text-sm"
            style={{
              position: "fixed",
              top: rect.top,
              left: rect.left,
              zIndex: 1000,
              background: "var(--erp-panel)",
              border: "1px solid var(--erp-border)",
              borderRadius: 4,
              padding: 8,
              width: 220,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            <form action={formAction}>
              {Object.entries(hiddenFields).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <p style={{ color: "var(--erp-danger)", marginBottom: 6 }}>{warningText}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span>
                  확인 코드 <strong>{code}</strong> 입력
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="erp-input"
                  style={{ width: 56, height: 24, padding: "0 6px", fontSize: 11.5 }}
                  autoFocus
                  aria-label={`삭제를 확인하려면 ${code}를 입력하세요`}
                />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="submit"
                  disabled={pending || !confirmMatches}
                  className="erp-btn erp-btn-danger"
                  style={{ minWidth: 0 }}
                >
                  {pending ? "삭제 중..." : "삭제"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirmText("");
                  }}
                  className="erp-btn"
                  style={{ minWidth: 0 }}
                >
                  취소
                </button>
              </div>
              <FormMessage state={state} />
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
