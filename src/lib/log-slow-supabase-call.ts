import { getCloudflareContext } from "@opennextjs/cloudflare";
import { reportServerError } from "@/lib/error-tracking";

// 로그인/로그아웃처럼 Supabase로 나가는 요청이 코드상 단 하나(또는
// 몇 개)뿐인 화면에서도 "20-30초씩 멈춘다"는 제보가 있었는데, 정확히
// 어느 구간이 그만큼 걸리는지(미들웨어? Worker 실행 위치? Supabase
// 응답 자체?) 증거 없이 추측만 쌓이고 있었다 — 다음에 재현될 때 바로
// 숫자로 확인하기 위한 측정 래퍼. 평소(정상 응답)에는 아무것도 남기지
// 않고, 이 문턱값을 넘겼을 때만 "어떤 호출이 몇 ms 걸렸는지"를 남긴다.
const SLOW_THRESHOLD_MS = 3000;

export async function logSlowSupabaseCall<T>(label: string, fn: () => PromiseLike<T>): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const durationMs = Date.now() - start;
    if (durationMs >= SLOW_THRESHOLD_MS) {
      console.error(JSON.stringify({ tag: "slowSupabaseCall", label, durationMs }));

      const report = () =>
        reportServerError(Object.assign(new Error(`${label} took ${durationMs}ms`), { name: "SlowSupabaseCallWarning" }), {
          label,
          durationMs,
        });

      // 응답을 돌려준 직후 Workers 요청 컨텍스트가 곧바로 끝날 수 있어서
      // (onRequestError처럼 "이미 실패해 더 기다려도 되는" 상황이 아니라,
      // 느리더라도 성공한 요청이라 응답을 추가로 지연시키면 안 된다),
      // Sentry 전송은 ctx.waitUntil로 응답 이후에도 끝까지 나가게 한다.
      // 클라우드플레어가 아닌 환경(로컬 dev 등)에서는 getCloudflareContext()
      // 가 실패하므로 그냥 기다렸다 보낸다.
      try {
        getCloudflareContext().ctx.waitUntil(report());
      } catch {
        await report();
      }
    }
  }
}
