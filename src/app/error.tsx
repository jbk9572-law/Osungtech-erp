"use client";

import { useEffect } from "react";
import Link from "next/link";

// (dashboard) 밖(로그인/회원가입/약관 등)에서 예외가 나면 여기가 대신
// 뜬다. erp-theme.css가 로드돼 있지 않은 경로에서도 동작해야 하므로
// 클래스 없이 인라인 스타일만 쓴다.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
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
        일시적인 오류가 발생했습니다.
      </p>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, maxWidth: 420 }}>
        잠시 후 다시 시도해주세요. 같은 문제가 반복되면 운영자에게 알려주세요.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
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
        <Link
          href="/login"
          style={{
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            padding: "0 16px",
            borderRadius: 4,
            border: "1px solid #e2e5eb",
            color: "#182338",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          로그인 화면으로
        </Link>
      </div>
    </div>
  );
}
