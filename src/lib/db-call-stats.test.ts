import { describe, expect, it } from "vitest";
import { runWithDbStats, withDbCallStats } from "./db-call-stats";

const fakeFetch = (delayMs: number): typeof fetch => async () => {
  await new Promise((r) => setTimeout(r, delayMs));
  return new Response("{}");
};

describe("db-call-stats", () => {
  it("요청 안에서 부른 횟수와 시간을 센다", async () => {
    const f = withDbCallStats(fakeFetch(5));
    const stats = await runWithDbStats(async (s) => {
      await Promise.all([f("http://x/1"), f("http://x/2"), f("http://x/3")]);
      return s;
    });
    expect(stats.calls).toBe(3);
    expect(stats.ms).toBeGreaterThanOrEqual(10);
  });

  it("서로 다른 요청의 통계는 섞이지 않는다", async () => {
    const f = withDbCallStats(fakeFetch(1));
    const [a, b] = await Promise.all([
      runWithDbStats(async (s) => {
        await f("http://x/a");
        return s;
      }),
      runWithDbStats(async (s) => {
        await f("http://x/b1");
        await f("http://x/b2");
        return s;
      }),
    ]);
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(2);
  });

  it("통계 상자가 없는 곳에서는 그냥 통과시킨다", async () => {
    const res = await withDbCallStats(fakeFetch(1))("http://x/none");
    expect(res.ok).toBe(true);
  });
});
