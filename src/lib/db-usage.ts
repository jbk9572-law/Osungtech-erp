import type { SupabaseClient } from "@supabase/supabase-js";

// Supabase 무료플랜 한도. 유료 전환 시 이 값들도 같이 바꿔야 한다.
export const FREE_TIER_DB_LIMIT_BYTES = 500 * 1024 * 1024;
export const FREE_TIER_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

export async function getDatabaseSizeBytes(
  supabase: SupabaseClient,
): Promise<number | null> {
  const { data, error } = await supabase.rpc("get_database_size");
  if (error || data == null) return null;
  return Number(data);
}

export async function getStorageSizeBytes(
  supabase: SupabaseClient,
): Promise<number | null> {
  const { data, error } = await supabase.rpc("get_storage_size");
  if (error || data == null) return null;
  return Number(data);
}
