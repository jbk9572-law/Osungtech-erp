import { AsyncLocalStorage } from "node:async_hooks";

// 화면 하나(요청 하나)가 Supabase를 몇 번 부르고, 그 대기가 합쳐서 몇 ms였는지 재는 장치. "느리다"를 추측이 아니라
// "DB 호출 N번, DB 대기 합 N ms"로 보기 위한 것이다. withPageTiming이 요청마다 통계 상자를 열어 주고,
// Supabase 서버 클라이언트의 fetch가 호출할 때마다 거기에 기록한다. 상자가 없는 곳(크론 등)에서는 아무것도 안 한다.
// 병렬 호출은 대기가 겹치므로 dbMs는 "각 호출 시간의 합"이다(실제 기다린 시간은 그보다 짧을 수 있다).
export type DbStats = { calls: number; ms: number };

const storage = new AsyncLocalStorage<DbStats>();

export function runWithDbStats<T>(fn: (stats: DbStats) => Promise<T>): Promise<T> {
  const stats: DbStats = { calls: 0, ms: 0 };
  return storage.run(stats, () => fn(stats));
}

// supabase-js의 global.fetch에 끼우는 감싸기 — 응답 본문을 읽기 전, 응답 헤더가 도착한 시점까지의 시간을 잰다.
export function withDbCallStats(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const stats = storage.getStore();
    if (!stats) return baseFetch(input, init);
    const start = performance.now();
    try {
      return await baseFetch(input, init);
    } finally {
      stats.calls += 1;
      stats.ms += performance.now() - start;
    }
  };
}
