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
import { MENU_ITEMS } from "@/lib/erp-menu";
import { findByLongestPrefix } from "@/lib/route-match";

// erp-menu.ts의 MENU_ITEMS에서 그대로 파생한다 — 예전엔 여기 따로 목록을
// 들고 있어서 미수금현황/미지급금현황처럼 실제 있는 라우트가 빠져 있었다
// (그 페이지에 들어가면 타이틀바 경로 표시가 비어 있었다).
const SECTION_LABEL: { prefix: string; label: string }[] = MENU_ITEMS.map(({ href, label }) => ({
  prefix: href,
  label,
}));

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
  const menuLabel = findByLongestPrefix(SECTION_LABEL, pathname, (s) => s.prefix)?.label ?? "";
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
        <Link href="/settings/backup" className="erp-titlebar-link">
          백업/복원
        </Link>
        <Link href="/settings/password" className="erp-titlebar-link">
          비밀번호 변경
        </Link>
        <form action={signOut}>
          <button type="submit">로그아웃</button>
        </form>
      </div>
    </header>
  );
}
