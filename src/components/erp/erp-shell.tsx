"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TitleBar } from "@/components/erp/title-bar";
import { Ribbon } from "@/components/erp/ribbon";
import { TreeMenu } from "@/components/erp/tree-menu";
import { TabBar } from "@/components/erp/tab-bar";
import { StatusBar } from "@/components/erp/status-bar";
import { RouteProgressBar } from "@/components/erp/route-progress-bar";
import { MidnightRefresh } from "@/components/erp/midnight-refresh";
import { NotificationToaster } from "@/components/erp/notification-toaster";
import { findMenuItem } from "@/lib/erp-menu";
import { pushRecentMenu } from "@/lib/erp-menu-history";

function RecentMenuTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const menu = findMenuItem(pathname);
    if (menu) pushRecentMenu(menu.href);
  }, [pathname]);
  return null;
}

export function ErpShell({
  isDemo,
  companyName,
  logoUrl,
  email,
  notificationBell,
  messengerWidget,
  usageWidget,
  disabledFeatures,
  isAdmin,
  children,
  modal,
}: {
  isDemo?: boolean;
  companyName?: string | null;
  logoUrl?: string | null;
  email: string | null;
  notificationBell: React.ReactNode;
  messengerWidget: React.ReactNode;
  usageWidget: React.ReactNode;
  disabledFeatures: string[];
  isAdmin: boolean;
  children: React.ReactNode;
  modal?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 모바일/좁은 화면에서는 240px 고정 사이드바가 화면 폭 대부분을
  // 차지해버려서, 폭이 768px 아래로 내려가면 자동으로 접고 이후엔
  // 오버레이 방식(드로어)으로 열리게 한다.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from matchMedia on mount
    setIsMobile(mq.matches);
    setCollapsed(mq.matches);
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      setCollapsed(e.matches);
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // 모바일에서 드로어가 열려있는 상태로 다른 메뉴로 이동하면 자동으로 닫는다.
  useEffect(() => {
    if (isMobile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 경로 변경에 반응해 드로어를 닫는 동기화
      setCollapsed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname 변경에만 반응한다
  }, [pathname]);

  // "/print"로 끝나는 라우트는 원래 전체 화면 이동(새 탭)이라 셸 자체를
  // 렌더링하지 않고 인쇄용 내용만 그렸다. 이제 명세표 인쇄처럼 옵션이
  // 있는 인쇄 화면은 모달(@modal 인터셉트 라우트)로도 뜨는데, 그때는
  // usePathname()이 똑같이 "/print"로 끝나는 값을 돌려주면서도 이
  // 컴포넌트가 그리는 건 배경 화면(children)과 모달(modal) 둘 다다 —
  // 여기서 그대로 조기 반환하면 modal 자체가 통째로 안 그려진다. 모달이
  // 있을 때는 평소처럼 전체 셸을 그리고, 인쇄 시 크롬/배경을 감추는 건
  // erp-theme.css의 @media print 규칙(.erp-modal-overlay 존재 시
  // .erp-body 숨김)에 맡긴다.
  if (pathname.endsWith("/print") && !modal) {
    return <>{children}</>;
  }

  return (
    <div className="erp">
      <a href="#erp-main-content" className="erp-skip-link">
        본문으로 바로가기
      </a>
      {isDemo && (
        <div className="erp-demo-banner">
          데모 모드 — 실제 데이터가 아니며, 여기서 등록/수정/삭제해도 실제 운영 데이터에는 영향을 주지 않습니다.
        </div>
      )}
      <NotificationToaster />
      <RecentMenuTracker />
      <MidnightRefresh />
      <TitleBar
        logoUrl={logoUrl}
        companyName={companyName}
        email={email}
        notificationBell={notificationBell}
        isMobile={isMobile}
        onToggleMenu={() => setCollapsed((c) => !c)}
      />
      <Ribbon disabledFeatures={disabledFeatures} isAdmin={isAdmin} />
      <div className="erp-body">
        <TreeMenu
          usageWidget={usageWidget}
          collapsed={collapsed}
          isMobile={isMobile}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          disabledFeatures={disabledFeatures}
          isAdmin={isAdmin}
        />
        <div className="erp-workspace">
          <RouteProgressBar />
          <TabBar />
          <div className="erp-page" id="erp-main-content" tabIndex={-1}>
            {children}
          </div>
        </div>
      </div>
      <StatusBar email={email} companyName={companyName} />
      {messengerWidget}
      {modal}
    </div>
  );
}
