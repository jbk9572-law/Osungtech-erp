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
    // 예전엔 `minHeight: "60vh"`로 세로 가운데 정렬을 했는데, 이 vh는
    // 브라우저 창 전체 높이 기준이라 타이틀바/리본/공지 배너/탭바가 위에
    // 쌓여 실제 본문 영역(.erp-page)이 그보다 훨씬 좁아지는 화면(특히
    // 모바일)에서는 60vh짜리 박스가 본문 영역의 스크롤 가능한 높이를
    // 넘어버렸다 — 화면상 스크롤을 내려야 버튼이 보이는데, 딱 봐서는
    // 스크롤 가능한 걸 알기 어려워 "화면이 반 잘려서 나온다"는 지적으로
    // 이어졌다. 뷰포트 기준 최소 높이를 강제하는 대신 내용만큼만 차지하게
    // 두고, 다른 화면의 알림 카드(erp-item-card 등)처럼 이 화면 영역
    // "안에" 담겨 있는 것처럼 보이도록 테두리로 감싼다.
    <div style={{ maxWidth: 560, margin: "32px auto", textAlign: "center" }}>
      <div
        style={{
          border: "1px solid var(--erp-border)",
          borderRadius: 0,
          background: "var(--erp-panel)",
          padding: "28px 20px",
        }}
      >
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--erp-text)", marginBottom: 8 }}>
          일시적인 오류로 화면을 불러오지 못했습니다.
        </p>
        <p style={{ fontSize: 12, color: "var(--erp-text-muted)", marginBottom: 20 }}>
          네트워크가 잠시 불안정했거나 데이터량이 많아 시간이 오래 걸렸을 수 있습니다.
          아래 버튼으로 다시 시도해보세요. 같은 화면에서 반복되면 아래 내용과 함께 운영자에게 알려주세요.
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
          <Link href="/dashboard" className="erp-btn">
            메인 화면으로
          </Link>
        </div>
      </div>
    </div>
  );
}
