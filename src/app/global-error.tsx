"use client";

// 루트 레이아웃(app/layout.tsx) 자체가 렌더링 중 던지는, 정말 최후의
// 예외만 여기서 잡는다 — 이 경우 layout.tsx도 같이 무효화되므로
// <html>/<body>를 직접 새로 그려야 한다(Next.js 요구사항). 극히 드물게만
// 발생해야 하는 경로라 스타일은 최소한으로만 인라인 처리한다.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          fontFamily: "-apple-system, sans-serif",
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 700, color: "#182338", marginBottom: 8 }}>
          문제가 발생해 페이지를 표시할 수 없습니다.
        </p>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, maxWidth: 420 }}>
          잠시 후 다시 시도해주세요.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            height: 36,
            padding: "0 16px",
            borderRadius: 4,
            background: "#132944",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            border: "none",
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
