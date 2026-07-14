"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import {
  NotificationBell,
  type AnnouncementItem,
  type DueTodoItem,
  type LowStockItem,
} from "@/components/erp/notification-bell";

const SECTION_LABEL: { prefix: string; label: string }[] = [
  { prefix: "/dashboard", label: "메인 대시보드" },
  { prefix: "/sales", label: "매출관리" },
  { prefix: "/purchases", label: "매입관리" },
  { prefix: "/inventory", label: "재고관리 > 재고현황" },
  { prefix: "/products", label: "품목관리" },
  { prefix: "/customers", label: "거래처관리 > 판매처관리" },
  { prefix: "/suppliers", label: "거래처관리 > 공급처관리" },
  { prefix: "/todos", label: "할일관리" },
  { prefix: "/announcements", label: "공지사항" },
  { prefix: "/settings", label: "환경설정" },
  { prefix: "/paper-calc", label: "확장모듈 > 모조지 계산" },
];

export function TitleBar({
  logoUrl,
  companyName,
  email,
  unreadAnnouncements,
  dueTodos,
  lowStock,
  isMobile,
  onToggleMenu,
}: {
  logoUrl?: string | null;
  companyName?: string | null;
  email: string | null;
  unreadAnnouncements: AnnouncementItem[];
  dueTodos: DueTodoItem[];
  lowStock: LowStockItem[];
  isMobile: boolean;
  onToggleMenu: () => void;
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
        {isMobile && (
          <button
            type="button"
            className="erp-titlebar-menu-toggle"
            onClick={onToggleMenu}
            aria-label="메뉴 열기/닫기"
          >
            ☰
          </button>
        )}
        <Link href="/dashboard" className="erp-titlebar-home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl || "/branding/logo-mark.png"} alt="" className="erp-titlebar-logo" />
          <span className="erp-titlebar-name">{companyName || "오성테크"} ERP</span>
        </Link>
        <span className="erp-titlebar-menu">{menuLabel}</span>
      </div>
      <div className="erp-titlebar-right">
        <span>{today}</span>
        <NotificationBell announcements={unreadAnnouncements} todos={dueTodos} lowStock={lowStock} />
        <span>{email}</span>
        <form action={signOut}>
          <button type="submit">로그아웃</button>
        </form>
      </div>
    </header>
  );
}
