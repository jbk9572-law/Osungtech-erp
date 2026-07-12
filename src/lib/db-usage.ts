import type { SupabaseClient } from "@supabase/supabase-js";

// Supabase 무료플랜 데이터베이스 용량 한도(500MB). 유료 전환 시 이 값도 같이 바꿔야 한다.
export const FREE_TIER_DB_LIMIT_BYTES = 500 * 1024 * 1024;

export async function getDatabaseSizeBytes(supabase: SupabaseClient): Promise<number | null> {
  const { data, error } = await supabase.rpc("get_database_size");
  if (error || data == null) return null;
  return Number(data);
}
