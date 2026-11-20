// 브라우저(화면 안)에서 짧은 시간만 값을 기억하는 작은 캐시 — 서버 프로세스용 ttl-cache.ts와는 별개다.
// 목록에서 같은 행을 다시 눌렀을 때 서버 조회를 반복하지 않으려고 쓴다.
// 화면이 다시 열리면(컴포넌트 새로 생성) 비워지므로, 다른 화면에서 데이터를 바꾸고 돌아오면 최신 값을 다시 받는다.
export function createRowDetailCache<T>(ttlMs: number, now: () => number = Date.now) {
  const store = new Map<string, { value: T; at: number }>();
  return {
    get(key: string): T | undefined {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (now() - hit.at > ttlMs) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: T) {
      store.set(key, { value, at: now() });
    },
    clear() {
      store.clear();
    },
  };
}
