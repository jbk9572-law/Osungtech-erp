import { reportServerError } from "@/lib/error-tracking";

// 어느 화면이 서버에서 몇 초 걸리는지 숫자로 알기 위한 측정 래퍼 — 앱 전체
// 속도 개선을 "추측"이 아니라 측정부터 하자는 결정으로 만들었다. 평소(문턱값
// 미만)에는 아무것도 남기지 않고, 문턱값을 넘긴 요청만 화면 이름과 소요
// 시간을 서버 로그와 Sentry에 남긴다(log-slow-supabase-call.ts의 3초 기준은
// 개별 쿼리용이고, 이 래퍼는 화면 하나가 통째로 걸린 시간이다).
// 페이지의 동작/반환값은 전혀 바꾸지 않는다 — 시간만 잰다.
const SLOW_PAGE_THRESHOLD_MS = 800;
// 같은 화면의 느림 기록은 1분에 한 번만 보낸다 — 느린 화면이 많을 때 Sentry/로그가 넘치지 않게.
const REPORT_INTERVAL_MS = 60_000;
const lastReportedAt = new Map<string, number>();

export function withPageTiming<Props>(
  label: string,
  page: (props: Props) => Promise<React.ReactNode>,
): (props: Props) => Promise<React.ReactNode> {
  return async function TimedPage(props: Props) {
    const start = Date.now();
    try {
      return await page(props);
    } finally {
      const durationMs = Date.now() - start;
      const now = Date.now();
      if (durationMs >= SLOW_PAGE_THRESHOLD_MS && now - (lastReportedAt.get(label) ?? 0) >= REPORT_INTERVAL_MS) {
        lastReportedAt.set(label, now);
        console.error(JSON.stringify({ tag: "slowPage", label, durationMs }));
        await reportServerError(
          Object.assign(new Error(`page ${label} took ${durationMs}ms`), { name: "SlowPageWarning" }),
          { label, durationMs },
        );
      }
    }
  };
}
