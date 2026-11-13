import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { isFeatureEnabled } from "@/lib/require-feature-enabled";

// 메인 화면 "오늘 근태" — 내 오늘 출퇴근 기록. 인사관리 기능을 껐거나 근태 메뉴를 끈 회사는 null이라 위젯 자체를
// 그리지 않는다. 내 기록만 조회한다(user_id 조건 + RLS).
export type DashboardAttendance = { clockInAt: string | null; clockOutAt: string | null };

export async function getDashboardAttendance(
  supabase: SupabaseClient<Database>,
  userId: string | null,
  todayKst: string,
): Promise<DashboardAttendance | null> {
  if (!userId) return null;
  const [hrOn, pageOn] = await Promise.all([
    isFeatureEnabled(supabase, "hr"),
    isFeatureEnabled(supabase, "/hr/attendance"),
  ]);
  if (!hrOn || !pageOn) return null;
  const { data } = await supabase
    .from("attendance_records")
    .select("clock_in_at, clock_out_at")
    .eq("user_id", userId)
    .eq("work_date", todayKst)
    .maybeSingle();
  return { clockInAt: data?.clock_in_at ?? null, clockOutAt: data?.clock_out_at ?? null };
}

// "08:52" 형태(한국 시간) — 기록이 없으면 null.
export function attendanceTimeLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
