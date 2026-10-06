"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnnouncementItem } from "@/components/erp/notification-bell";
import { pollMyMail } from "@/lib/mail/poll-action";
import { playAlertSound } from "@/lib/play-alert-sound";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 공지 재확인 — 10분마다(할일 마감/안전재고는 메신저 시스템봇으로 옮겼다)
// 거래처 발주처럼 놓치면 안 되는 알림은 훨씬 짧은 주기로 확인하고 소리까지
// 울린다(메일 확인과 같은 수준의 체감 실시간성 — 아래 MAIL_POLL_INTERVAL_MS
// 참고).
const URGENT_POLL_INTERVAL_MS = 30 * 1000;
const URGENT_AUTO_HIDE_MS = 3 * 60 * 1000; // 일반 토스트(1분)보다 길게 — 놓치지 않게
// 메일은 훨씬 짧게 잡는다 — "업무 보다가 메일 기다리기엔 5분(크론 주기)도
// 길다"는 지적이 있어서, 탭이 열려 있는 동안만큼은 이 주기로 체감상
// 실시간에 가깝게 확인한다(pollMyMail — 본인 세션으로만 도는 가벼운
// 확인이라 45초 정도는 서버에 부담이 크지 않다). 탭이 안 열려 있는 동안은
// 5분짜리 GitHub Actions 크론(api/cron/mail-sync)이 대신 받아둔다.
const MAIL_POLL_INTERVAL_MS = 45 * 1000;
const AUTO_HIDE_MS = 60 * 1000; // 1분

type Summary = { announcements: AnnouncementItem[] };

type ToastEntry = {
  key: string;
  href: string;
  title: string;
  meta?: string;
  urgent?: boolean;
};

// 타이틀바 종을 확인하지 않고 놔두면, 미확인 공지·새 메일을 화면 구석에
// 주기적으로 다시 띄워준다(할일 마감임박/지연·안전재고부족은 그룹웨어
// 메신저 "전체" 채널에 시스템봇이 올리는 쪽으로 옮겨서 여기서는 뺐다 —
// notification-bell.tsx 참고). 항목을 하나로 뭉쳐서 보여주지 않고,
// 항목마다 각자 독립된 박스로 하나씩 쌓아 올린다.
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
      setTimeout(() => dismiss(entry.key), entry.urgent ? URGENT_AUTO_HIDE_MS : AUTO_HIDE_MS)
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
    let cancelled = false;
    // DB에서는 계속 "안 읽음"으로 남아있는 게 맞다(/customer-orders를
    // 실제로 열어야 읽음 처리) — 그렇다고 30초마다 같은 알림에 소리를
    // 또 울리면 안 되니, 이 탭에서 이미 토스트로 보여준 알림 id는 따로
    // 기억해 그 뒤로는 조용히 건너뛴다.
    const seenIds = new Set<string>();

    async function checkUrgent() {
      try {
        const res = await fetch("/api/notifications/urgent", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data: { notices: { id: string; title: string; body: string | null; url: string | null }[] } =
          await res.json();
        if (cancelled) return;
        const freshNotices = data.notices.filter((n) => !seenIds.has(n.id));
        freshNotices.forEach((n) => seenIds.add(n.id));
        if (freshNotices.length === 0) return;

        playAlertSound();
        freshNotices.forEach((n) => {
          pushToast({
            key: `urgent-${n.id}`,
            href: n.url ?? "/dashboard",
            title: `🔔 ${n.title}`,
            meta: n.body ?? undefined,
            urgent: true,
          });
        });
      } catch {
        // 네트워크 오류는 조용히 무시하고 다음 주기에 다시 시도한다.
      }
    }

    checkUrgent();
    const interval = setInterval(checkUrgent, URGENT_POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) checkUrgent();
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
        <div
          key={toast.key}
          className={toast.urgent ? "erp-toast erp-toast-urgent" : "erp-toast"}
          role={toast.urgent ? "alert" : "status"}
        >
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
