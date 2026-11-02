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

      // 상시 가동 Node 서버라 요청이 끝나도 프로세스가 계속 떠 있으므로
      // (Workers의 ctx.waitUntil 같은 별도 장치 없이도) 그냥 보내면 된다.
      await reportServerError(
        Object.assign(new Error(`${label} took ${durationMs}ms`), { name: "SlowSupabaseCallWarning" }),
        { label, durationMs },
      );
    }
  }
}
