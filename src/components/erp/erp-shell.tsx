"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { TitleBar } from "@/components/erp/title-bar";
import type {
  AnnouncementItem,
  DueTodoItem,
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
  initialMessages: MessengerMessage[];
  profileNames: Record<string, string>;
  currentUserId: string;
  dbSizeBytes: number | null;
  storageSizeBytes: number | null;
  vpsDisk: VpsDiskUsage | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
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
      />
      <Ribbon />
      <div className="erp-body">
        <TreeMenu
          dbSizeBytes={dbSizeBytes}
          storageSizeBytes={storageSizeBytes}
          vpsDisk={vpsDisk}
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
