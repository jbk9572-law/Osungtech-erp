import { formatKstDate, formatKstTime } from "@/lib/kst-date";

// 채팅방 행의 시각 — 오늘이면 시각, 아니면 월/일
export function formatRowTime(iso: string): string {
  const todayKey = new Date().toLocaleDateString("sv-SE");
  if (dateKey(iso) === todayKey) return formatKstTime(iso, { hour: "numeric", minute: "2-digit" });
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function dateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE");
}

export function formatDateLabel(key: string): string {
  const todayKey = new Date().toLocaleDateString("sv-SE");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toLocaleDateString("sv-SE");
  if (key === todayKey) return "오늘";
  if (key === yesterdayKey) return "어제";
  return formatKstDate(key, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}
