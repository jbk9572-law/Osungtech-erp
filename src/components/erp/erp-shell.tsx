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

  if (pathname.endsWith("/print")) {
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
      <Ribbon disabledFeatures={disabledFeatures} />
      <div className="erp-body">
        <TreeMenu
          usageWidget={usageWidget}
          collapsed={collapsed}
          isMobile={isMobile}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          disabledFeatures={disabledFeatures}
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
