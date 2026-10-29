"use server";

import { createClient, getUser } from "@/lib/supabase/server";

// 매출/매입 등 가로형 표의 "보고 싶은 칸만 보기" 설정 — 계정마다 보고
// 싶은 칸이 다를 수 있다는 요청이라, grid_key + user_id로 계정별로
// 저장한다(칸 너비는 회사 전체 공유라 반대로 설계됨 —
// grid-column-widths-actions.ts 참고).
export async function getGridColumnVisibility(gridKey: string): Promise<string[] | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ui_grid_column_visibility")
    .select("hidden_columns")
    .eq("grid_key", gridKey)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error(`표 칸 표시 설정 조회 실패(${gridKey}):`, error);
  }

  return data?.hidden_columns ?? null;
}

export async function saveGridColumnVisibility(gridKey: string, hiddenColumns: string[]): Promise<void> {
  const user = await getUser();
  if (!user) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ui_grid_column_visibility")
    .upsert(
      { grid_key: gridKey, user_id: user.id, hidden_columns: hiddenColumns, updated_at: new Date().toISOString() },
      { onConflict: "grid_key,user_id" },
    );
  if (error) throw error;
}
