"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AnnouncementItem, DueTodoItem } from "@/components/erp/notification-bell";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10분마다 재확인
const AUTO_HIDE_MS = 10 * 1000;

type Summary = { announcements: AnnouncementItem[]; todos: DueTodoItem[] };

// 타이틀바 종/대시보드 배너를 확인하지 않고 놔두면, 메신저 알림처럼 10분마다
// 미확인 공지·마감 임박 할일을 화면 구석에 다시 띄워준다.
export function NotificationToaster() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data: Summary = await res.json();
        if (cancelled) return;
        if (data.announcements.length > 0 || data.todos.length > 0) {
          setSummary(data);
          setVisible(true);
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          hideTimerRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
        }
      } catch {
        // 네트워크 오류는 조용히 무시하고 다음 주기에 다시 시도한다.
      }
    }

    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!visible || !summary) return null;

  const total = summary.announcements.length + summary.todos.length;
  const firstAnnouncement = summary.announcements[0];
  const firstTodo = summary.todos[0];
  const shownCount = (firstAnnouncement ? 1 : 0) + (firstTodo ? 1 : 0);
  const moreCount = total - shownCount;

  return (
    <div className="erp-toast" role="status">
      <button type="button" className="erp-toast-close" onClick={() => setVisible(false)} aria-label="닫기">
        ✕
      </button>
      <div className="erp-toast-title">🔔 아직 확인하지 않은 항목이 있어요 ({total})</div>
      {firstAnnouncement && (
        <Link href={`/announcements/${firstAnnouncement.id}`} className="erp-toast-item" onClick={() => setVisible(false)}>
          {firstAnnouncement.pinned ? "📌 " : ""}
          {firstAnnouncement.title}
        </Link>
      )}
      {firstTodo && (
        <Link href={`/todos/${firstTodo.id}`} className="erp-toast-item" onClick={() => setVisible(false)}>
          {firstTodo.title}
          {firstTodo.due_date && <span style={{ marginLeft: 6, opacity: 0.7 }}>{firstTodo.due_date}</span>}
        </Link>
      )}
      {moreCount > 0 && <div className="erp-toast-more">외 {moreCount}건 더 있음</div>}
    </div>
  );
}
