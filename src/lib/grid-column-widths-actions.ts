"use server";

import { createClient } from "@/lib/supabase/server";

// 매출/매입 등록 폼 품목 그리드의 칸 너비 조절값을 DB에 저장/조회한다.
// localStorage였을 땐 조절한 사람의 브라우저에서만 반영돼 다른 직원
// 화면은 계속 예전(깨져 보이는) 너비 그대로였다 — grid_key별로 한 행에
// 최신 값을 저장해 전 직원이 같은 너비를 보게 한다.
export async function getGridColumnWidths(
  gridKey: string,
): Promise<Record<string, number> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ui_grid_column_widths")
    .select("widths")
    .eq("grid_key", gridKey)
    .maybeSingle();

  return (data?.widths as Record<string, number> | null) ?? null;
}

export async function saveGridColumnWidths(
  gridKey: string,
  widths: Record<string, number>,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ui_grid_column_widths")
    .upsert(
      { grid_key: gridKey, widths, updated_at: new Date().toISOString() },
      { onConflict: "grid_key,is_demo" },
    );
  if (error) throw error;
}
