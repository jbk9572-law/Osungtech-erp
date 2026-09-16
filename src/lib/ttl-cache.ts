// 요청마다 새로 계산하기엔 아까운, 몇 십 초~몇 분 정도는 오래돼도 괜찮은
// 값을 워커/서버 인스턴스 안에서만 잠깐 재사용한다. Next.js의
// unstable_cache는 cookies()에 의존하는 함수 안에서는 쓸 수 없어서(요청
// 스코프 API 사용 금지 규칙), 쿠키 기반 Supabase 클라이언트를 쓰는 값들은
// 이 아주 단순한 프로세스 내 TTL 캐시로 대신한다. 여러 서버 인스턴스/엣지
// 위치마다 각자 따로 캐시하고 전역으로 공유되진 않지만, 매 요청마다
// 다시 계산하는 것보다는 훨씬 낫다.
type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export async function ttlCached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await compute();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}
