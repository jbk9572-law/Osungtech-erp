import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCalendarItems, type CalendarItem } from "@/lib/calendar-data";
import { CalendarMonthView } from "@/components/erp/calendar-month-view";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function buildWeeks(year: number, month: number) {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: ({ dateStr: string; day: number } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ dateStr: toDateStr(year, month, day), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const { y, m } = await searchParams;
  const now = new Date();
  const year = y ? Number(y) : now.getFullYear();
  const month = m && Number(m) >= 1 && Number(m) <= 12 ? Number(m) : now.getMonth() + 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("id, tenant_id, is_demo, role").eq("id", user.id).maybeSingle()
    : { data: null };

  const weeks = buildWeeks(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${pad(month)}-01T00:00:00`;
  const monthEnd = `${year}-${pad(month)}-${pad(daysInMonth)}T23:59:59`;
  const monthMin = toDateStr(year, month, 1);
  const monthMax = toDateStr(year, month, daysInMonth);

  const items = profile
    ? await getCalendarItems(supabase, {
        from: monthStart,
        to: monthEnd,
        tenantId: profile.tenant_id,
        isDemo: profile.is_demo,
      })
    : [];

  const itemsByDate: Record<string, CalendarItem[]> = {};
  for (const item of items) {
    let cur = item.startAt.slice(0, 10);
    const end = item.endAt.slice(0, 10);
    let guard = 0;
    while (cur <= end && guard < 366) {
      if (cur >= monthMin && cur <= monthMax) {
        (itemsByDate[cur] ??= []).push(item);
      }
      const d = new Date(`${cur}T00:00:00`);
      d.setDate(d.getDate() + 1);
      cur = d.toLocaleDateString("sv-SE");
      guard += 1;
    }
  }

  const todayStr = now.toLocaleDateString("sv-SE");
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  let feedUrl: string | null = null;
  if (profile) {
    const { data: token } = await supabase.rpc("get_or_create_calendar_feed_token");
    if (token) {
      const h = await headers();
      const host = h.get("host");
      feedUrl = `https://${host}/api/calendar/feed?token=${token}`;
    }
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/calendar/new" }, Escape: { href: "/dashboard" } }} />
      <ListPageHeader
        title="캘린더"
        actions={
          <Link href="/calendar/new" className="erp-btn erp-btn-primary">
            F2 새 일정
          </Link>
        }
      />
      <PageGuide>
        회의/기타 일정을 등록하면 회사 전체에 공유됩니다. 승인된 연차는 자동으로 표시됩니다. 사이드바의 구독 URL을 구글/아웃룩 등
        외부 캘린더 앱에 등록하면 이 화면의 일정을 그대로 받아볼 수 있습니다.
      </PageGuide>

      <CalendarMonthView
        year={year}
        month={month}
        weeks={weeks}
        itemsByDate={itemsByDate}
        todayStr={todayStr}
        prevMonthHref={`/calendar?y=${prevYear}&m=${prevMonth}`}
        nextMonthHref={`/calendar?y=${nextYear}&m=${nextMonth}`}
        feedUrl={feedUrl}
        currentUserId={profile?.id ?? null}
        isAdmin={profile?.role === "admin"}
      />
    </div>
  );
}
