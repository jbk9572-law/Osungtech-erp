"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";

const SECTION_LABEL: { prefix: string; label: string }[] = [
  { prefix: "/dashboard", label: "메인 대시보드" },
  { prefix: "/sales", label: "영업관리 > 수주관리" },
  { prefix: "/purchases", label: "구매관리 > 발주관리" },
  { prefix: "/inventory", label: "재고관리 > 재고현황" },
  { prefix: "/products", label: "품목관리" },
  { prefix: "/customers", label: "거래처관리 > 판매처관리" },
  { prefix: "/suppliers", label: "거래처관리 > 공급처관리" },
  { prefix: "/settings", label: "환경설정" },
];

export function TitleBar({
  logoUrl,
  companyName,
  email,
}: {
  logoUrl?: string | null;
  companyName?: string | null;
  email: string | null;
}) {
  const pathname = usePathname();
  const menuLabel = SECTION_LABEL.find((s) => pathname.startsWith(s.prefix))?.label ?? "";
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <header className="erp-titlebar">
      <div className="erp-titlebar-left">
        <Link href="/dashboard" className="erp-titlebar-home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl || "/branding/logo-mark.png"} alt="" className="erp-titlebar-logo" />
          <span className="erp-titlebar-name">{companyName || "오성테크"} ERP</span>
        </Link>
        <span className="erp-titlebar-menu">{menuLabel}</span>
      </div>
      <div className="erp-titlebar-right">
        <span>{today}</span>
        <span>{email}</span>
        <form action={signOut}>
          <button type="submit">로그아웃</button>
        </form>
      </div>
    </header>
  );
}
