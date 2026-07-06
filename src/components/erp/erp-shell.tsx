"use client";

import { usePathname } from "next/navigation";
import { ErpTopbar } from "@/components/erp/erp-topbar";
import { ErpTreeNav } from "@/components/erp/erp-tree-nav";
import { ErpTabBar } from "@/components/erp/erp-tab-bar";

export function ErpShell({
  companyName,
  logoUrl,
  email,
  children,
}: {
  companyName: string;
  logoUrl?: string | null;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // 인쇄용 화면(거래명세표 등)은 정밀하게 맞춰둔 자체 레이아웃을 써야 하므로
  // 클래식 ERP 셸(상단바/트리메뉴/탭)을 씌우지 않고 그대로 통과시킨다.
  if (pathname.endsWith("/print")) {
    return <>{children}</>;
  }

  return (
    <div className="erp">
      <ErpTopbar companyName={companyName} logoUrl={logoUrl} email={email} />
      <div className="erp-body">
        <ErpTreeNav />
        <div className="erp-workspace">
          <ErpTabBar />
          <div className="erp-page">{children}</div>
        </div>
      </div>
    </div>
  );
}
