import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { ttlCached } from "@/lib/ttl-cache";

// Supabase 무료플랜 한도. 유료 전환 시 이 값들도 같이 바꿔야 한다.
export const FREE_TIER_DB_LIMIT_BYTES = 500 * 1024 * 1024;
export const FREE_TIER_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

// DB/스토리지 용량은 대시보드 레이아웃(모든 화면 공통)에서 페이지 이동할
// 때마다 RPC로 다시 조회하고 있었다 — 분 단위로만 맞아도 충분한 값이라
// 5분간 재사용한다. 쿠키 기반 supabase 클라이언트를 쓰는 함수라
// unstable_cache는 못 쓰고(요청 스코프 API 제약) 대신 프로세스 내
// TTL 캐시를 쓴다.
export async function getDatabaseSizeBytes(
  supabase: SupabaseClient<Database>,
): Promise<number | null> {
  return ttlCached("db-size-bytes", 5 * 60 * 1000, async () => {
    const { data, error } = await supabase.rpc("get_database_size");
    if (error || data == null) return null;
    return Number(data);
  });
}

export async function getStorageSizeBytes(
  supabase: SupabaseClient<Database>,
): Promise<number | null> {
  return ttlCached("storage-size-bytes", 5 * 60 * 1000, async () => {
    const { data, error } = await supabase.rpc("get_storage_size");
    if (error || data == null) return null;
    return Number(data);
  });
}
