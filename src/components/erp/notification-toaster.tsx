"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnnouncementItem, DueTodoItem, LowStockItem } from "@/components/erp/notification-bell";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10분마다 재확인
const AUTO_HIDE_MS = 60 * 1000; // 1분

type Summary = { announcements: AnnouncementItem[]; todos: DueTodoItem[]; lowStock: LowStockItem[] };

type ToastEntry = {
  key: string;
  href: string;
  title: string;
  meta?: string;
};

// 타이틀바 종/대시보드 배너를 확인하지 않고 놔두면, 메신저 알림처럼 10분마다
// 미확인 공지·마감 임박 할일을 화면 구석에 다시 띄워준다. 항목을 하나로
// 뭉쳐서 보여주지 않고, 항목마다 각자 독립된 박스로 하나씩 쌓아 올린다.
export function NotificationToaster() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((key: string) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
    const timer = timersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(key);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timers = timersRef.current;

    function pushToast(entry: ToastEntry) {
      setToasts((prev) => (prev.some((t) => t.key === entry.key) ? prev : [...prev, entry]));
      const existing = timers.get(entry.key);
      if (existing) clearTimeout(existing);
      timers.set(
        entry.key,
        setTimeout(() => dismiss(entry.key), AUTO_HIDE_MS)
      );
    }

    async function check() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data: Summary = await res.json();
        if (cancelled) return;
        data.announcements.forEach((a) => {
          pushToast({
            key: `a-${a.id}`,
            href: `/announcements/${a.id}`,
            title: `${a.pinned ? "📌 " : ""}${a.title}`,
          });
        });
        data.todos.forEach((t) => {
          pushToast({
            key: `t-${t.id}`,
            href: `/todos/${t.id}`,
            title: t.title,
            meta: t.due_date ? `마감 ${t.due_date}` : undefined,
          });
        });
        data.lowStock.forEach((p) => {
          pushToast({
            key: `s-${p.id}`,
            href: `/inventory/${p.id}`,
            title: `⚠️ ${p.name} 안전재고 부족`,
            meta: `현재 ${p.quantity.toLocaleString()} / 기준 ${p.reorderPoint.toLocaleString()}`,
          });
        });
      } catch {
        // 네트워크 오류는 조용히 무시하고 다음 주기에 다시 시도한다.
      }
    }

    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [dismiss]);

  if (!toasts.length) return null;

  return (
    <div className="erp-toast-stack">
      {toasts.map((toast) => (
        <div key={toast.key} className="erp-toast" role="status">
          <button
            type="button"
            className="erp-toast-close"
            onClick={() => dismiss(toast.key)}
            aria-label="닫기"
          >
            ✕
          </button>
          <Link href={toast.href} className="erp-toast-item" onClick={() => dismiss(toast.key)}>
            {toast.title}
            {toast.meta && <span style={{ marginLeft: 6, opacity: 0.7 }}>{toast.meta}</span>}
          </Link>
        </div>
      ))}
    </div>
  );
}
