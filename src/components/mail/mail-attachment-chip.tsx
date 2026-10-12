"use client";

import { useState } from "react";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { PaperclipIcon } from "@/components/erp/groupware-icons";

// 메일 첨부파일을 누르면 예전엔 새 창(target="_blank")으로 열었다 —
// PDF 한 장 보려고 브라우저 탭을 새로 띄워야 했다. PDF/이미지는 등록
// 모달 셸(registration-modal-shell.tsx)과 같은 erp-modal 틀 안에서
// 바로 미리보기를 띄우고(PDF는 브라우저 내장 뷰어를 쓰는 iframe), 그
// 외 형식(zip, hwp 등)은 미리보기를 못 그리니 안내문 + 다운로드
// 버튼만 보여준다.
export function MailAttachmentChip({
  filename,
  contentType,
  url,
}: {
  filename: string;
  contentType: string | null;
  url: string | null;
}) {
  const [open, setOpen] = useState(false);
  useEscapeToClose(open, () => setOpen(false));
  useScrollLock(open);

  if (!url) {
    return (
      <span className="erp-btn" style={{ opacity: 0.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span className="erp-icon" style={{ width: 13, height: 13 }} aria-hidden>
          <PaperclipIcon />
        </span>
        {filename}
      </span>
    );
  }

  const isPdf = contentType === "application/pdf";
  const isImage = (contentType ?? "").startsWith("image/");

  return (
    <>
      <button
        type="button"
        className="erp-btn"
        style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
        onClick={() => setOpen(true)}
      >
        <span className="erp-icon" style={{ width: 13, height: 13 }} aria-hidden>
          <PaperclipIcon />
        </span>
        {filename}
      </button>

      {open && (
        <div
          className="erp-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="erp-modal erp-modal-lg" style={{ minHeight: 0 }}>
            <button type="button" className="erp-modal-window-close print:hidden" onClick={() => setOpen(false)} aria-label="닫기">
              ✕
            </button>
            <div className="erp-modal-title">
              <span>{filename}</span>
              <a href={url} download={filename} className="erp-btn" style={{ height: 24, padding: "1px 10px", fontSize: 11 }}>
                다운로드
              </a>
            </div>
            <div className="erp-modal-body" style={{ flex: 1, minHeight: 0, padding: isPdf ? 0 : undefined }}>
              {isPdf ? (
                <iframe title={filename} src={url} style={{ width: "100%", height: "100%", minHeight: "75vh", border: "none" }} />
              ) : isImage ? (
                <img src={url} alt={filename} style={{ maxWidth: "100%", display: "block", margin: "0 auto" }} />
              ) : (
                <p className="erp-grid-empty" style={{ marginTop: 24 }}>
                  이 파일 형식은 화면에서 미리볼 수 없습니다. 다운로드해 확인해주세요.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
