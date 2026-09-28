"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// @modal 병렬 라우트 슬롯 전용 에러 경계. (dashboard)/error.tsx는 children
// 슬롯(본문 화면)에서 난 예외만 잡아주고, @modal 슬롯(목록 위에 뜨는 상세/
// 등록 모달)에서 난 예외는 잡아주지 않는다 — 이 파일이 없던 동안은 모달
// 쪽 예외가 더 상위 경계까지 올라가면서, 이미 정상적으로 떠 있던 본문
// 화면(목록/트리메뉴 등)은 그대로 남은 채 그 아래 아무 상관없는 자리에
// 에러 박스만 따로 붙어 보이는 원인이 됐다("화면이 반 잘려 보인다"는
// 지적이 계속 재현된 이유). 예: 인터셉트 라우트가 UUID 아닌 값을 그대로
// 조회해 던진 에러(migration 없이 코드로 고친 별개 버그)가 정확히 이
// 경로로 새어나왔었다.
//
// 여기서 잡으면 본문(children)은 전혀 건드리지 않고, 모달 자리에만
// 작게 "불러오지 못했습니다" 오버레이를 띄운다 — RegistrationModalShell과
// 같은 시각 언어(erp-modal-overlay/erp-modal)를 써서 진짜 모달이 실패한
// 것처럼 자연스럽게 보인다.
export default function ModalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="erp-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div className="erp-modal erp-modal-md" style={{ minHeight: 0 }}>
        <button
          type="button"
          className="erp-modal-window-close"
          onClick={() => router.back()}
          aria-label="닫기"
        >
          ✕
        </button>
        <div className="erp-modal-body" style={{ padding: "32px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--erp-text)", marginBottom: 8 }}>
            이 항목을 불러오지 못했습니다.
          </p>
          <p style={{ fontSize: 12, color: "var(--erp-text-muted)", marginBottom: 20 }}>
            일시적인 오류일 수 있습니다. 목록 화면은 그대로 있으니, 닫고 다시 열어보세요.
          </p>
          {(error.message || error.digest) && (
            <p
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "var(--erp-text-muted)",
                background: "var(--erp-bg-subtle)",
                border: "1px solid var(--erp-border)",
                borderRadius: 0,
                padding: "8px 12px",
                marginBottom: 20,
                wordBreak: "break-word",
                textAlign: "left",
              }}
            >
              {error.message || "(메시지 없음)"}
              {error.digest && (
                <>
                  <br />
                  digest: {error.digest}
                </>
              )}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button type="button" onClick={() => reset()} className="erp-btn erp-btn-primary">
              다시 시도
            </button>
            <button type="button" onClick={() => router.back()} className="erp-btn">
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
