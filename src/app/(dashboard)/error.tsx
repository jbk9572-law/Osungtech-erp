"use client";

import { useEffect } from "react";
import Link from "next/link";

// (dashboard) 레이아웃(타이틀바/트리메뉴) 아래 화면 하나가 렌더링 중
// 예외를 던지면 이 경계가 대신 뜬다 — 지금까지 앱 전체에 이런 에러
// 경계가 하나도 없어서, 재고실사처럼 조회량이 많은 화면에서 일시적인
// 오류(네트워크 순단, DB 응답 지연 등)가 나면 클라우드플레어/Next.js가
// 대신 내려주는 날것의 에러 화면만 보였다 — 거기엔 앱 안에서 재시도할
// 방법이 없어 브라우저 새로고침밖에 할 수 없었고, 클라우드플레어 요금제를
// 올려 CPU 시간 한도(1102의 원인)를 늘려도 이 종류의 오류는 CPU 한도와
// 무관해서 전혀 나아지지 않았다.
export default function DashboardError({
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
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 20px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--erp-text)", marginBottom: 8 }}>
        일시적인 오류로 화면을 불러오지 못했습니다.
      </p>
      <p style={{ fontSize: 12, color: "var(--erp-text-muted)", marginBottom: 20, maxWidth: 420 }}>
        네트워크가 잠시 불안정했거나 데이터량이 많아 시간이 오래 걸렸을 수 있습니다.
        아래 버튼으로 다시 시도해보세요. 같은 화면에서 반복되면 운영자에게 알려주세요.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => reset()} className="erp-btn erp-btn-primary">
          다시 시도
        </button>
        <Link href="/dashboard" className="erp-btn">
          메인 화면으로
        </Link>
      </div>
    </div>
  );
}
