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
    try {
      const { data, error } = await supabase.rpc("get_database_size");
      if (error || data == null) return null;
      return Number(data);
    } catch {
      return null;
    }
  });
}

export async function getStorageSizeBytes(
  supabase: SupabaseClient<Database>,
): Promise<number | null> {
  return ttlCached("storage-size-bytes", 5 * 60 * 1000, async () => {
    try {
      const { data, error } = await supabase.rpc("get_storage_size");
      if (error || data == null) return null;
      return Number(data);
    } catch {
      return null;
    }
  });
}

// Cloudflare R2 무료 한도(2026-10 기준 공식 가격표) — 저장 10GB, 쓰기(Class
// A) 월 100만회, 읽기(Class B) 월 1000만회. 저장 용량은 tenant_usage 합산으로
// 실제 추적 중이라 바로 보여줄 수 있지만, 쓰기/읽기 횟수는 R2 호출 지점
// (src/lib/r2/client.ts)에 카운터를 따로 안 붙여놔서 지금은 집계할 데이터가
// 없다 — 숫자를 지어내지 않고 한도만 참고용으로 보여준다(UsageWidget 참고).
export const FREE_TIER_R2_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;
export const R2_STORAGE_OVERAGE_USD_PER_GB = 0.015;
export const R2_FREE_CLASS_A_OPS_PER_MONTH = 1_000_000;
export const R2_FREE_CLASS_B_OPS_PER_MONTH = 10_000_000;

export async function getR2TotalFileBytes(
  supabase: SupabaseClient<Database>,
): Promise<number | null> {
  return ttlCached("r2-total-file-bytes", 5 * 60 * 1000, async () => {
    try {
      const { data, error } = await supabase.rpc("get_platform_r2_usage");
      if (error || data == null) return null;
      return Number(data);
    } catch {
      return null;
    }
  });
}
