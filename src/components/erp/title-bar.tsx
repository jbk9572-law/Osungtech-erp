"use client";

import { formatKstDate } from "@/lib/kst-date";
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { LogoutButton } from "@/components/erp/logout-button";
import { MENU_ITEMS } from "@/lib/erp-menu";
import { findByLongestPrefix } from "@/lib/route-match";
import { useThemeFeatures } from "@/lib/erp-theme-features";
import { QUICK_SEARCH_EVENT } from "@/lib/quick-search-event";
import { useClickOutside } from "@/lib/use-click-outside";
import { useEscapeToClose } from "@/lib/use-escape-to-close";

// erp-menu.ts의 MENU_ITEMS에서 그대로 파생한다 — 예전엔 여기 따로 목록을
// 들고 있어서 미수금현황/미지급금현황처럼 실제 있는 라우트가 빠져 있었다
// (그 페이지에 들어가면 타이틀바 경로 표시가 비어 있었다).
const SECTION_LABEL: { prefix: string; label: string }[] = MENU_ITEMS.map(({ href, label }) => ({
  prefix: href,
  label,
}));

// 모던 틀의 사용자 메뉴 — 시안처럼 상단바에는 아바타 하나만 두고, 비밀번호 변경·백업/복원·로그아웃 같은 개인 메뉴는 여기에 모은다.
function UserMenu({ email, isPlatformAdmin }: { email: string | null; isPlatformAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(open, [ref], () => setOpen(false));
  useEscapeToClose(open, () => setOpen(false));
  return (
    <div className="erp-usermenu" ref={ref}>
      <button type="button" className="erp-usermenu-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="erp-titlebar-avatar" aria-hidden>
          {(email ?? "?").trim().charAt(0).toUpperCase()}
        </span>
        <span className="erp-usermenu-name">{email}</span>
      </button>
      {open && (
        <div className="erp-usermenu-pop" role="menu">
          {isPlatformAdmin && (
            <Link href="/platform-admin" role="menuitem" onClick={() => setOpen(false)}>
              플랫폼 관리자
            </Link>
          )}
          <Link href="/settings/backup" role="menuitem" onClick={() => setOpen(false)}>
            백업/복원
          </Link>
          <Link href="/settings/password" role="menuitem" onClick={() => setOpen(false)}>
            비밀번호 변경
          </Link>
          <form action={signOut}>
            <LogoutButton />
          </form>
        </div>
      )}
    </div>
  );
}

export function TitleBar({
  logoUrl,
  companyName,
  email,
  notificationBell,
  isMobile,
  onToggleMenu,
  isPlatformAdmin,
  tools,
}: {
  logoUrl?: string | null;
  companyName?: string | null;
  email: string | null;
  // 알림 종은 서버 컴포넌트(notification-bell-panel.tsx)가 조회해서
  // 미리 렌더링해 넘겨준다 — usage-widget과 같은 이유로, 이 조회가
  // 느려지거나 실패해도 타이틀바 나머지는 영향받지 않게 분리했다.
  notificationBell: ReactNode;
  isMobile: boolean;
  onToggleMenu: () => void;
  // 엘보닉스 플랫폼 운영자에게만 보이는 링크 — 지금까지 /platform-admin은
  // 메뉴 어디에도 없이 주소를 직접 입력해야만 들어갈 수 있었다. 일반
  // 테넌트 관리자에게는 여전히 안 보여야 하므로 isPlatformAdmin일 때만
  // 렌더링한다(layout.tsx가 is_platform_admin RPC로 이미 판별해서 내려줌).
  isPlatformAdmin?: boolean;
  // 모던 틀에서 상단바 안에 함께 그릴 도구(리본의 새로고침·즐겨찾기·최근 메뉴·도움말 아이콘) — 없으면 그리지 않는다.
  tools?: ReactNode;
}) {
  const pathname = usePathname();
  const { appChrome } = useThemeFeatures();
  const menuLabel = findByLongestPrefix(SECTION_LABEL, pathname, (s) => s.prefix)?.label ?? "";
  const today = formatKstDate(new Date(), {
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
          <span className="erp-titlebar-name">{companyName || "회사명 미설정"} ERP</span>
        </Link>
        <span className="erp-titlebar-menu">{menuLabel}</span>
      </div>
      {appChrome && !isMobile ? (
        <div className="erp-titlebar-right">
          {tools}
          <button
            type="button"
            className="erp-titlebar-search"
            aria-label="메뉴 빠른 검색 열기 (Ctrl+K)"
            onClick={() => window.dispatchEvent(new Event(QUICK_SEARCH_EVENT))}
          >
            <span className="erp-titlebar-search-text">메뉴 이름으로 검색</span>
            <kbd>Ctrl K</kbd>
          </button>
          {notificationBell}
          <UserMenu email={email} isPlatformAdmin={isPlatformAdmin} />
        </div>
      ) : (
        <div className="erp-titlebar-right">
          <span>{today}</span>
          {notificationBell}
          <span>{email}</span>
          {isPlatformAdmin && (
            <Link href="/platform-admin" className="erp-titlebar-link erp-titlebar-link-persistent">
              플랫폼 관리자
            </Link>
          )}
          <Link href="/settings/backup" className="erp-titlebar-link">
            백업/복원
          </Link>
          <Link href="/settings/password" className="erp-titlebar-link">
            비밀번호 변경
          </Link>
          <form action={signOut}>
            <LogoutButton />
          </form>
        </div>
      )}
    </header>
  );
}
