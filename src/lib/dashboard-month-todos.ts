import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// 달력 칸에 띠로 보여줄 "이 달에 마감인 할 일"(아직 안 끝난 것만) — 날짜별로 묶어서 돌려준다. 한 달에 많아야 수십 건이라
// 상한만 둔다. RLS가 같은 회사 것만 걸러준다.
export type MonthTodo = { id: string; title: string };

export async function getMonthTodosByDate(
  supabase: SupabaseClient<Database>,
  monthStart: string,
  monthEnd: string,
): Promise<Record<string, MonthTodo[]>> {
  const { data } = await supabase
    .from("todos")
    .select("id, title, due_date")
    .eq("done", false)
    .gte("due_date", monthStart)
    .lte("due_date", monthEnd)
    .order("due_date", { ascending: true })
    .limit(300);
  const out: Record<string, MonthTodo[]> = {};
  for (const t of data ?? []) {
    if (!t.due_date) continue;
    (out[t.due_date] ??= []).push({ id: t.id, title: t.title });
  }
  return out;
}
