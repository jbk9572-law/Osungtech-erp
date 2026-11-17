import { describe, expect, it } from "vitest";
import { invalidateTtlCache, ttlCached } from "./ttl-cache";
import { invalidateLayoutCache, layoutCacheKey } from "./layout-cache";

describe("ttlCached 무효화", () => {
  it("접두어가 같은 캐시만 비우고 나머지는 남긴다", async () => {
    let a = 0;
    let b = 0;
    await ttlCached("test:a", 60_000, async () => ++a);
    await ttlCached("other:b", 60_000, async () => ++b);
    invalidateTtlCache("test:");
    expect(await ttlCached("test:a", 60_000, async () => ++a)).toBe(2); // 다시 계산
    expect(await ttlCached("other:b", 60_000, async () => ++b)).toBe(1); // 그대로
  });
});

describe("레이아웃 캐시 무효화(회사 전환·회사 정보 저장 직후)", () => {
  it("전환 직후에는 같은 사용자라도 새로 계산한다", async () => {
    let calls = 0;
    const key = layoutCacheKey("bootstrap", "user-1");
    expect(await ttlCached(key, 60_000, async () => ++calls)).toBe(1);
    expect(await ttlCached(key, 60_000, async () => ++calls)).toBe(1); // 10초 안에는 재사용
    invalidateLayoutCache();
    expect(await ttlCached(key, 60_000, async () => ++calls)).toBe(2); // 전환 후 새 값
  });
});
