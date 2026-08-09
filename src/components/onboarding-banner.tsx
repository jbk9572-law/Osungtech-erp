"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "erp-onboarding-dismissed";

// 처음 접속한 사람에게만 한 번 보여주는 가벼운 안내. 새 기능이 아니라
// 이미 있는 것들(Ctrl+K 빠른 검색, 리본의 도움말 단축키 목록)을 처음
// 켜본 사람이 찾기 쉽게 알려주는 용도라, 닫으면 localStorage에 기억해서
// 다시 안 보여준다. 서버 렌더링 시점엔 localStorage를 알 수 없으니
// 처음엔 항상 아무것도 그리지 않고, 마운트 후에만 판단해서 보여준다
// (그래야 서버/클라이언트 첫 렌더 결과가 같아서 하이드레이션 경고가
// 안 난다).
export function OnboardingBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(DISMISS_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 localStorage 값을 한 번만 동기화
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded-sm px-3 py-2 text-xs"
      style={{ background: "var(--erp-info-bg)", border: "1px solid var(--erp-info-border)", color: "var(--erp-info-text)" }}
    >
      <span style={{ fontWeight: 700 }}>처음이신가요?</span>
      <span>
        <kbd
          style={{
            fontFamily: "inherit",
            background: "#fff",
            border: "1px solid var(--erp-info-border)",
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          Ctrl+K
        </kbd>{" "}
        로 어디서든 메뉴를 검색할 수 있고, 상단 리본의{" "}
        <span style={{ fontWeight: 700 }}>? 도움말</span>을 누르면 F키 단축키 목록을 볼 수 있어요.
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="ml-auto"
        style={{ color: "var(--erp-info-text)", fontWeight: 700, opacity: 0.7 }}
        aria-label="안내 닫기"
      >
        ✕
      </button>
    </div>
  );
}
