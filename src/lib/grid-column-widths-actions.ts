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
  const { data, error } = await supabase
    .from("ui_grid_column_widths")
    .select("widths")
    .eq("grid_key", gridKey)
    .maybeSingle();

  // 저장된 값이 아직 없는 것(정상)과 조회 자체가 실패한 것(테이블 없음/
  // 권한 문제 등)을 구분해 로그로 남긴다 — 둘 다 조용히 null을 반환해
  // 화면은 기본값으로 그대로 동작하지만, 후자를 아무 흔적 없이 삼키면
  // "왜 저장이 안 되냐"는 문의가 와도 원인을 못 찾는다(실제로 있었던 일).
  if (error) {
    console.error(`표 칸 너비 조회 실패(${gridKey}):`, error);
  }

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
