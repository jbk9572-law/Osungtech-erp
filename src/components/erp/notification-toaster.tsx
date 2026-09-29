"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnnouncementItem, DueTodoItem, LowStockItem } from "@/components/erp/notification-bell";
import { formatNumber } from "@/lib/format-number";
import { pollMyMail } from "@/lib/mail/poll-action";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 공지/할일/재고 재확인 — 10분마다
// 메일은 훨씬 짧게 잡는다 — "업무 보다가 메일 기다리기엔 5분(크론 주기)도
// 길다"는 지적이 있어서, 탭이 열려 있는 동안만큼은 이 주기로 체감상
// 실시간에 가깝게 확인한다(pollMyMail — 본인 세션으로만 도는 가벼운
// 확인이라 45초 정도는 서버에 부담이 크지 않다). 탭이 안 열려 있는 동안은
// 5분짜리 GitHub Actions 크론(api/cron/mail-sync)이 대신 받아둔다.
const MAIL_POLL_INTERVAL_MS = 45 * 1000;
const AUTO_HIDE_MS = 60 * 1000; // 1분

type Summary = { announcements: AnnouncementItem[]; todos: DueTodoItem[]; lowStock: LowStockItem[] };

type ToastEntry = {
  key: string;
  href: string;
  title: string;
  meta?: string;
};

// 타이틀바 종/대시보드 배너를 확인하지 않고 놔두면, 메신저 알림처럼 주기적으로
// 미확인 공지·마감 임박 할일·새 메일을 화면 구석에 다시 띄워준다. 항목을
// 하나로 뭉쳐서 보여주지 않고, 항목마다 각자 독립된 박스로 하나씩 쌓아 올린다.
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

  const pushToast = useCallback((entry: ToastEntry) => {
    setToasts((prev) => (prev.some((t) => t.key === entry.key) ? prev : [...prev, entry]));
    const timers = timersRef.current;
    const existing = timers.get(entry.key);
    if (existing) clearTimeout(existing);
    timers.set(
      entry.key,
      setTimeout(() => dismiss(entry.key), AUTO_HIDE_MS)
    );
  }, [dismiss]);

  useEffect(() => {
    let cancelled = false;

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
          const metaParts = [
            t.due_date ? `마감 ${t.due_date}` : null,
            t.itemCount > 0 ? `품목 ${t.itemCount}건` : null,
          ].filter(Boolean);
          pushToast({
            key: `t-${t.id}`,
            href: `/todos/${t.id}`,
            title: t.title,
            meta: metaParts.length ? metaParts.join(" · ") : undefined,
          });
        });
        data.lowStock.forEach((p) => {
          pushToast({
            key: `s-${p.id}`,
            href: `/inventory/item/${p.id}`,
            title: `⚠️ ${p.name} 안전재고 부족`,
            meta: `현재 ${formatNumber(p.quantity)} / 기준 ${formatNumber(p.reorderPoint)}`,
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
    };
  }, [pushToast]);

  useEffect(() => {
    let cancelled = false;

    async function checkMail() {
      // 탭이 백그라운드에 있는 동안은 건너뛴다 — 그 시간은 5분짜리 크론이
      // 대신 받아두므로, 안 보고 있는 탭이 45초마다 IMAP 접속을 여는 건
      // 낭비다. 탭이 다시 보이게 되는 순간 곧바로 한 번 더 확인한다.
      if (document.hidden) return;
      try {
        const data = await pollMyMail();
        if (cancelled || data.newCount <= 0) return;
        pushToast({
          key: `mail-${Date.now()}`,
          href: "/mail",
          title: "📧 새 메일 도착",
          meta: `${data.newCount}통`,
        });
      } catch {
        // 네트워크 오류는 조용히 무시하고 다음 주기에 다시 시도한다.
      }
    }

    checkMail();
    const interval = setInterval(checkMail, MAIL_POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) checkMail();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pushToast]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

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
