"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { startRouteProgress } from "@/lib/route-progress";
import { useClickOutside } from "@/lib/use-click-outside";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { PushSubscribeToggle } from "@/components/erp/push-subscribe-toggle";

export type AnnouncementItem = { id: string; title: string; pinned: boolean };

// 할일 마감임박/지연·안전재고부족은 예전엔 이 종 드롭다운 + 토스트
// 팝업에도 떴는데, 그룹웨어 메신저 "전체" 채널에도 시스템봇이 똑같은
// 내용을 올리게 되면서(src/lib/messenger-system-alerts.ts, 15분 주기
// 크론) 확인할 곳이 두 군데로 쪼개지는 중복이 생겼다 — 다들 평소에
// 열어두는 메신저 쪽으로 몰아주고, 종은 공지사항만 남긴다.
export function NotificationBell({ announcements }: { announcements: AnnouncementItem[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
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
    router.push(href);
  }

  return (
    <div style={{ position: "relative" }} ref={wrapRef}>
      <button
        type="button"
        className="erp-bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="알림"
      >
        🔔
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
                >
                  {a.pinned ? "📌 " : ""}
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
