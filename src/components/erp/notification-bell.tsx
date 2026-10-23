"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useRef, useState } from "react";
import { startRouteProgress } from "@/lib/route-progress";
import { useClickOutside } from "@/lib/use-click-outside";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { PushSubscribeToggle } from "@/components/erp/push-subscribe-toggle";
import { BellIcon } from "@/components/erp/groupware-icons";
import { GridBadge } from "@/components/grid/badge";
import { buildBackHref } from "@/lib/list-return";

export type AnnouncementItem = { id: string; title: string; pinned: boolean };

// 할일 마감임박/지연·안전재고부족은 예전엔 이 종 드롭다운 + 토스트
// 팝업에도 떴는데, 그룹웨어 메신저 "전체" 채널에도 시스템봇이 똑같은
// 내용을 올리게 되면서(src/lib/messenger-system-alerts.ts, 15분 주기
// 크론) 확인할 곳이 두 군데로 쪼개지는 중복이 생겼다 — 다들 평소에
// 열어두는 메신저 쪽으로 몰아주고, 종은 공지사항만 남긴다.
// useSearchParams()를 쓰므로(지금 보고 있는 화면으로 되돌아가기 위한
// back 파라미터 계산용) route-progress-bar.tsx와 같은 이유로 이 안에서
// 직접 Suspense로 감싼다 — 모든 화면 레이아웃에 떠 있는 전역 컴포넌트라
// 호출부마다 Suspense를 씌우게 하면 깜빡하기 쉽다.
function NotificationBellInner({ announcements }: { announcements: AnnouncementItem[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const count = announcements.length;
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(open, wrapRef, close);
  // 캡처 단계에서 먼저 가로채 stopPropagation한다 — 안 그러면 이 Escape가
  // 그대로 버블돼 페이지 전역 ESC 단축키(KeyboardShortcuts)까지 도달해서
  // 드롭다운만 닫으려던 것뿐인데 페이지를 나가버리는 사고가 난다.
  useEscapeToClose(open, close);

  function go(href: string) {
    setOpen(false);
    startRouteProgress();
    // 이 종은 모든 화면에 떠 있어서, 공지사항을 열었다가 닫으면 공지
    // 목록이 아니라 지금 보고 있던 화면 그대로 돌아와야 한다(사용자
    // 지적 — "상세보기 끄면 엉뚱한 메뉴로 이동해버린다").
    const query = searchParams.toString();
    const back = buildBackHref(query ? `${pathname}?${query}` : pathname);
    router.push(`${href}${href.includes("?") ? "&" : "?"}back=${back}`);
  }

  return (
    <div style={{ position: "relative" }} ref={wrapRef}>
      <button
        type="button"
        className="erp-bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="알림"
      >
        <span className="erp-icon" aria-hidden style={{ width: 15, height: 15 }}>
          <BellIcon />
        </span>
        {count > 0 && (
          <span className="erp-bell-badge">{count > 99 ? "99+" : count}</span>
        )}
      </button>
      {open && (
        <div className="erp-ribbon-dropdown erp-bell-dropdown">
          <div className="erp-bell-section-title">
            공지사항
            {announcements.length > 0 ? ` (${announcements.length})` : ""}
          </div>
          {announcements.length ? (
            announcements.map((a) => (
              <div key={a.id} className="erp-ribbon-dropdown-item">
                <button
                  type="button"
                  onClick={() => go(`/announcements/${a.id}`)}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  {a.pinned && <GridBadge tone="info">고정</GridBadge>}
                  {a.title}
                </button>
              </div>
            ))
          ) : (
            <p className="erp-ribbon-dropdown-empty">
              읽지 않은 공지사항이 없습니다.
            </p>
          )}

          <div className="erp-bell-footer">
            <Link href="/announcements" onClick={() => setOpen(false)}>
              공지사항 전체보기
            </Link>
            <Link href="/messenger" onClick={() => setOpen(false)}>
              할일·재고 알림은 메신저에서 →
            </Link>
          </div>
          <PushSubscribeToggle />
        </div>
      )}
    </div>
  );
}

export function NotificationBell({ announcements }: { announcements: AnnouncementItem[] }) {
  return (
    <Suspense fallback={null}>
      <NotificationBellInner announcements={announcements} />
    </Suspense>
  );
}
