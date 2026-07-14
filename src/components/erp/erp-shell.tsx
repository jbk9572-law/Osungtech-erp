"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TitleBar } from "@/components/erp/title-bar";
import type {
  AnnouncementItem,
  DueTodoItem,
  LowStockItem,
} from "@/components/erp/notification-bell";
import { Ribbon } from "@/components/erp/ribbon";
import { TreeMenu } from "@/components/erp/tree-menu";
import { TabBar } from "@/components/erp/tab-bar";
import { StatusBar } from "@/components/erp/status-bar";
import { RouteProgressBar } from "@/components/erp/route-progress-bar";
import { NotificationToaster } from "@/components/erp/notification-toaster";
import {
  MessengerWidget,
  type MessengerMessage,
} from "@/components/erp/messenger-widget";
import { findMenuItem } from "@/lib/erp-menu";
import { pushRecentMenu } from "@/lib/erp-menu-history";
import type { VpsDiskUsage } from "@/lib/vps-usage";

function RecentMenuTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const menu = findMenuItem(pathname);
    if (menu) pushRecentMenu(menu.href);
  }, [pathname]);
  return null;
}

export function ErpShell({
  companyName,
  logoUrl,
  email,
  unreadAnnouncements,
  dueTodos,
  lowStock,
  initialMessages,
  profileNames,
  currentUserId,
  dbSizeBytes,
  storageSizeBytes,
  vpsDisk,
  children,
}: {
  companyName?: string | null;
  logoUrl?: string | null;
  email: string | null;
  unreadAnnouncements: AnnouncementItem[];
  dueTodos: DueTodoItem[];
  lowStock: LowStockItem[];
  initialMessages: MessengerMessage[];
  profileNames: Record<string, string>;
  currentUserId: string;
  dbSizeBytes: number | null;
  storageSizeBytes: number | null;
  vpsDisk: VpsDiskUsage | null;
  children: React.ReactNode;
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
      <RouteProgressBar />
      <NotificationToaster />
      <RecentMenuTracker />
      <TitleBar
        logoUrl={logoUrl}
        companyName={companyName}
        email={email}
        unreadAnnouncements={unreadAnnouncements}
        dueTodos={dueTodos}
        lowStock={lowStock}
        isMobile={isMobile}
        onToggleMenu={() => setCollapsed((c) => !c)}
      />
      <Ribbon />
      <div className="erp-body">
        <TreeMenu
          dbSizeBytes={dbSizeBytes}
          storageSizeBytes={storageSizeBytes}
          vpsDisk={vpsDisk}
          collapsed={collapsed}
          isMobile={isMobile}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
        <div className="erp-workspace">
          <TabBar />
          <div className="erp-page">{children}</div>
        </div>
      </div>
      <StatusBar email={email} companyName={companyName} />
      <MessengerWidget
        initialMessages={initialMessages}
        profileNames={profileNames}
        currentUserId={currentUserId}
      />
    </div>
  );
}
