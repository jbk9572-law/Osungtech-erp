import { revalidatePath } from "next/cache";
import { invalidateTtlCache } from "@/lib/ttl-cache";

// (dashboard)/layout.tsx가 메인 레이아웃 정보(회사명·로고·내 프로필·회사 설정)를 10초 동안 서버 메모리에 캐시한다.
// 캐시 키가 사용자 ID뿐이라 같은 사용자가 회사를 전환하거나 회사 이름·로고를 바꿔도 최대 10초간 옛 값이 보였다
// (좌측 상단 회사명·로고만 새로고침해야 바뀌던 문제). 레이아웃 정보가 바뀌는 곳은 저장 직후 이 함수로 캐시를 비운다.
export const LAYOUT_CACHE_PREFIX = "layout:";

export function layoutCacheKey(kind: "bootstrap" | "impersonation-tenants", userId: string): string {
  return `${LAYOUT_CACHE_PREFIX}${kind}:${userId}`;
}

export function invalidateLayoutCache(): void {
  invalidateTtlCache(LAYOUT_CACHE_PREFIX);
}

// 회사 전환·회사 정보 저장 직후 한 번에 부른다: 서버 메모리 캐시를 비우고, 브라우저 라우터 캐시도 무효화해서
// 이미 열려 있던 화면이 직전 레이아웃(이전 회사)을 재사용하지 않게 한다.
export function refreshLayout(): void {
  invalidateLayoutCache();
  revalidatePath("/", "layout");
}
