"use client";

import { useActionState, useEffect, useState } from "react";
import { sendMailAction } from "@/app/(dashboard)/mail/actions";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { FormMessage } from "@/components/form-message";

function ComposeModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(sendMailAction, undefined);
  useEscapeToClose(true, onClose);

  useEffect(() => {
    if (state?.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 보내기 성공했을 때만 자동으로 닫는다
  }, [state?.success]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 20, 30, 0.55)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="erp-detail"
        style={{ marginTop: 0, maxWidth: 640, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column" }}
      >
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active" style={{ cursor: "default" }}>
            메일쓰기
          </span>
        </div>
        <form action={formAction} className="erp-detail-body flex flex-col gap-3" style={{ overflow: "auto" }}>
          <div className="erp-field">
            <label htmlFor="cm-to">받는 사람</label>
            <input id="cm-to" name="to" autoComplete="off" required className="erp-input" placeholder="쉼표로 여러 명 구분" />
          </div>
          <div className="erp-field">
            <label htmlFor="cm-cc">참조(선택)</label>
            <input id="cm-cc" name="cc" autoComplete="off" className="erp-input" />
          </div>
          <div className="erp-field">
            <label htmlFor="cm-subject">제목</label>
            <input id="cm-subject" name="subject" autoComplete="off" required className="erp-input" />
          </div>
          <div className="erp-field">
            <label htmlFor="cm-body">내용</label>
            <textarea id="cm-body" name="body" rows={10} className="erp-input" style={{ resize: "vertical" }} />
          </div>
          <div className="erp-field">
            <label htmlFor="cm-attachments">첨부파일(선택)</label>
            <input id="cm-attachments" name="attachments" type="file" multiple className="erp-input" />
          </div>

          <FormMessage state={state} />

          <div className="flex gap-2">
            <button type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
              {pending ? "보내는 중..." : "보내기"}
            </button>
            <button type="button" className="erp-btn" onClick={onClose} disabled={pending}>
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ComposeMailButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="erp-btn erp-btn-primary" onClick={() => setOpen(true)}>
        ✏️ 메일쓰기
      </button>
      {open && <ComposeModal onClose={() => setOpen(false)} />}
    </>
  );
}
