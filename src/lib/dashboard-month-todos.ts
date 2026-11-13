import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// 달력 칸에 띠로 보여줄 "이 달에 마감인 할 일"(아직 안 끝난 것만) — 날짜별로 묶어서 돌려준다. 한 달에 많아야 수십 건이라
// 상한만 두고, 상한을 넘으면 truncated로 알려서 달력 아래에 "일부만 표시" 안내를 띄운다. RLS가 같은 회사 것만 걸러준다.
export type MonthTodo = { id: string; title: string };
export const MONTH_TODO_LIMIT = 300;

export async function getMonthTodosByDate(
  supabase: SupabaseClient<Database>,
  monthStart: string,
  monthEnd: string,
): Promise<{ byDate: Record<string, MonthTodo[]>; truncated: boolean }> {
  const { data } = await supabase
    .from("todos")
    .select("id, title, due_date")
    .eq("done", false)
    .gte("due_date", monthStart)
    .lte("due_date", monthEnd)
    .order("due_date", { ascending: true })
    .limit(MONTH_TODO_LIMIT + 1); // 하나 더 받아 보고 상한을 넘었는지 안다
  const out: Record<string, MonthTodo[]> = {};
  const rows = data ?? [];
  const truncated = rows.length > MONTH_TODO_LIMIT;
  for (const t of rows.slice(0, MONTH_TODO_LIMIT)) {
    if (!t.due_date) continue;
    (out[t.due_date] ??= []).push({ id: t.id, title: t.title });
  }
  return { byDate: out, truncated };
}
