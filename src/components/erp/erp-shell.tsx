"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { TitleBar } from "@/components/erp/title-bar";
import { Ribbon } from "@/components/erp/ribbon";
import { TreeMenu } from "@/components/erp/tree-menu";
import { TabBar } from "@/components/erp/tab-bar";
import { StatusBar } from "@/components/erp/status-bar";
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
  companyName,
  logoUrl,
  email,
  children,
}: {
  companyName?: string | null;
  logoUrl?: string | null;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname.endsWith("/print")) {
    return <>{children}</>;
  }

  return (
    <div className="erp">
      <RecentMenuTracker />
      <TitleBar logoUrl={logoUrl} companyName={companyName} email={email} />
      <Ribbon />
      <div className="erp-body">
        <TreeMenu />
        <div className="erp-workspace">
          <TabBar />
          <div className="erp-page">{children}</div>
        </div>
      </div>
      <StatusBar email={email} companyName={companyName} />
    </div>
  );
}
