"use client";

import { useState, type ReactNode } from "react";
import { ModalOverlay } from "@/components/erp/modal-overlay";

// "현재 화면 그대로 엑셀로 다운로드" 버튼 — 리포트/목록 화면 여러 곳이 같은 부품을 쓴다(개발헌법 3번).
// 예전엔 일반 링크(<a href>)라서 ① 누르자마자 받아져 무엇을 받는지 확인할 수 없었고 ② 앱의 "이동 중…" 가림막이 켜졌는데 다운로드는 화면이
// 바뀌지 않아 꺼질 신호가 없어 15초 안전장치가 풀릴 때까지 화면이 막혔다. 이제 버튼이다:
// 누르면 확인 창("엑셀 파일로 받을까요?") → [받기] → 버튼이 "만드는 중…"으로 바뀌고 → 끝나면 파일이 받아진다. 실패하면 이유를 안내한다.
// 모양(⬇ 아이콘)은 모던 테마 CSS가 붙인다 — 글자는 그대로 "엑셀"이다(클래식은 동결).

function fileNameFrom(header: string | null, href: string): string {
  const star = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = header?.match(/filename="?([^";]+)"?/i)?.[1];
  const raw = star ?? plain;
  if (raw) {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return `${href.split("?")[0].split("/").filter(Boolean).slice(-2, -1)[0] ?? "내역"}.xlsx`;
}

export function ExcelDownloadLink({
  href,
  title = "현재 화면 그대로 엑셀로 다운로드",
  label = "엑셀",
  pushRight = false,
  primary = false,
}: {
  href: string;
  // 마우스를 올리면 뜨는 설명이자 확인 창의 안내 문장(화면마다 "이번달 … 결과"처럼 무엇이 담기는지 적는다).
  title?: string;
  label?: ReactNode;
  // 툴바 안에서 다른 버튼과 나란히 두지 않고 오른쪽 끝으로 밀 때(리포트
  // 화면 다수가 이 모양)만 켠다.
  pushRight?: boolean;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(href, { credentials: "same-origin" });
      if (res.status === 401) throw new Error("로그인이 만료되었습니다. 새로고침한 뒤 다시 로그인해 주세요.");
      if (!res.ok) throw new Error("엑셀 파일을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFrom(res.headers.get("content-disposition"), href);
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "엑셀 파일을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`erp-btn erp-tb-export${primary ? " erp-btn-primary" : ""}`}
        title={title}
        aria-haspopup="dialog"
        aria-busy={busy}
        disabled={busy}
        style={pushRight ? { marginLeft: "auto" } : undefined}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {busy ? "만드는 중…" : label}
      </button>
      {open && (
        <ModalOverlay onClose={() => (busy ? undefined : setOpen(false))} sheet>
          <div className="erp-confirm">
            <h3 className="erp-confirm-title">엑셀 파일로 받을까요?</h3>
            <p className="erp-confirm-body">{title.includes("엑셀") ? title : `${title} — 엑셀 파일(.xlsx)로 내려받습니다.`}</p>
            {error && (
              <p className="erp-confirm-error" role="alert">
                {error}
              </p>
            )}
            <div className="erp-confirm-actions">
              <button type="button" className="erp-btn" onClick={() => setOpen(false)} disabled={busy}>
                취소
              </button>
              <button type="button" className="erp-btn erp-btn-primary" onClick={download} disabled={busy} autoFocus>
                {busy ? "만드는 중…" : error ? "다시 받기" : "받기"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
