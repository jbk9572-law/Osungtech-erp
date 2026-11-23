"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { formatKstDate } from "@/lib/kst-date";
import { GridSelectionStats } from "@/components/erp/grid-selection-stats";
import { GridRowPositionStatus, useGridRowPosition } from "@/components/erp/grid-row-position";
import { useThemeFeatures } from "@/lib/erp-theme-features";
import { MENU_ITEMS } from "@/lib/erp-menu";
import { findByLongestPrefix } from "@/lib/route-match";

const MENU_LABELS = MENU_ITEMS.map(({ href, label }) => ({ prefix: href, label }));

// 브라우저의 온라인/오프라인 상태 — 서버 연결이 실제로 끊겼는지가 아니라 이 기기의 네트워크 상태다(문구도 그렇게 적는다).
function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 한 번 브라우저 상태와 맞춘다
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function StatusBar({
  email,
  companyName,
}: {
  email: string | null;
  companyName?: string | null;
}) {
  const { appChrome } = useThemeFeatures();
  if (appChrome) return <ModernStatusBar />;
  const now = formatKstDate();

  return (
    <div className="erp-statusbar">
      <span>사용자: {email}</span>
      <span className="sep">|</span>
      <span>회사: {companyName || "회사명 미설정"}</span>
      <span className="sep">|</span>
      <span>{now}</span>
      <GridSelectionStats />
      <span style={{ marginLeft: "auto" }}>ELVONIX v1.0</span>
    </div>
  );
}

// 모던 틀의 하단 상태줄 — 왼쪽: 연결 상태 · 현재 메뉴 경로 · 행 위치 / 오른쪽: 이 화면에서 실제로 되는 조작 힌트.
// (사용자·회사·날짜는 상단바에 이미 있다.)
function ModernStatusBar() {
  const pathname = usePathname();
  const online = useOnline();
  const rowPos = useGridRowPosition();
  const label = findByLongestPrefix(MENU_LABELS, pathname, (s) => s.prefix)?.label ?? "";
  return (
    <div className="erp-statusbar erp-statusbar-modern">
      <span className={`erp-statusbar-conn${online ? "" : " off"}`} role="status">
        {online ? "연결됨" : "오프라인"}
      </span>
      {label && <span>{label}</span>}
      <GridRowPositionStatus pos={rowPos} />
      <GridSelectionStats />
      <span className="erp-statusbar-hint">
        {rowPos ? "행 클릭 = 상세 패널 · ↑↓ 이동 · Enter 열기 · Ctrl+K 메뉴 검색" : "Ctrl+K 메뉴 검색"}
      </span>
    </div>
  );
}
