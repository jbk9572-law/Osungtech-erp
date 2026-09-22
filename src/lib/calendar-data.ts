import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { LEAVE_UNIT_LABEL, type LeaveUnit } from "@/lib/leave-unit";

export type CalendarItemSource = "meeting" | "leave";

export type CalendarItem = {
  id: string;
  rawId: string;
  source: CalendarItemSource;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  createdBy: string | null;
};

// 회사 공유 캘린더에 합쳐서 보여줄 항목을 모은다 — 수동 등록 일정
// (calendar_events)과 승인된 연차(leave_requests)를 한 함수에서 합쳐서,
// 화면(월간 보기)과 ICS 구독 피드가 서로 다른 로직을 갖지 않게 한다.
//
// 피드 라우트는 로그인 세션이 없는 외부 캘린더 앱의 요청이라 서비스 롤
// (admin) 클라이언트로 조회한다 — RLS가 아예 안 걸리므로 tenantId/isDemo를
// 반드시 여기서 명시적으로 걸러야 한다. 화면 쪽(RLS가 걸린 사용자 클라이언트)도
// 같은 필터를 중복으로 걸어 방어적으로 통일한다 — 백업 내보내기에서 한 번
// 터졌던 테넌트 간 데이터 유출과 같은 종류의 실수를 반복하지 않기 위함.
export async function getCalendarItems(
  supabase: SupabaseClient<Database>,
  params: { from: string; to: string; tenantId: string; isDemo: boolean },
): Promise<CalendarItem[]> {
  const { from, to, tenantId, isDemo } = params;

  const [eventsRes, leaveRes] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("id, title, description, location, start_at, end_at, all_day, created_by")
      .eq("tenant_id", tenantId)
      .eq("is_demo", isDemo)
      .lte("start_at", to)
      .gte("end_at", from)
      .order("start_at", { ascending: true })
      .limit(500),
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, leave_unit, profiles!user_id(full_name)")
      .eq("tenant_id", tenantId)
      .eq("is_demo", isDemo)
      .eq("status", "approved")
      .lte("start_date", to)
      .gte("end_date", from)
      .limit(500),
  ]);

  const items: CalendarItem[] = [];

  for (const row of eventsRes.data ?? []) {
    items.push({
      id: `meeting:${row.id}`,
      rawId: row.id,
      source: "meeting",
      title: row.title,
      description: row.description ?? "",
      location: row.location ?? "",
      startAt: row.start_at,
      endAt: row.end_at,
      allDay: row.all_day,
      createdBy: row.created_by,
    });
  }

  for (const row of leaveRes.data ?? []) {
    const name = (row.profiles as { full_name: string | null } | null)?.full_name ?? "직원";
    const unit = row.leave_unit as LeaveUnit;
    const unitLabel = LEAVE_UNIT_LABEL[unit] ?? "";
    const suffix = unit === "full" ? "" : ` (${unitLabel})`;
    items.push({
      id: `leave:${row.id}`,
      rawId: row.id,
      source: "leave",
      title: `${name} 연차${suffix}`,
      description: "",
      location: "",
      startAt: `${row.start_date}T00:00:00`,
      endAt: `${row.end_date}T23:59:59`,
      allDay: true,
      createdBy: null,
    });
  }

  return items.sort((a, b) => a.startAt.localeCompare(b.startAt));
}
