// 50개+ 테넌트로 늘어날 걸 대비한 가벼운 에러 추적 연동(사용자 요청
// — "경량 에러 로깅 툴 연동"). 공식 @sentry/nextjs SDK는 next.config
// 빌드 플러그인/소스맵 업로드/엣지 런타임 계측까지 끌고 들어와서, 이미
// standalone/Cloudflare Workers용으로 세밀하게 맞춰둔 빌드 설정을
// 건드릴 위험이 있다 — 대신 Sentry의 HTTP 수집 API(Envelope)에 직접
// fetch로 보내는 수십 줄짜리 함수 하나로 끝낸다. SENTRY_DSN 환경변수가
// 없으면 아무 일도 하지 않는다(아직 연동 전이거나 안 쓰는 테넌트/환경도
// 그냥 조용히 넘어간다).
function parseSentryDsn(dsn: string): { ingestUrl: string; publicKey: string } | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "");
    if (!publicKey || !projectId) return null;
    return { ingestUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`, publicKey };
  } catch {
    return null;
  }
}

export async function reportServerError(
  error: unknown,
  extra?: Record<string, unknown>,
): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const parsed = parseSentryDsn(dsn);
  if (!parsed) return;

  try {
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const sentAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "Error";
    const stack = error instanceof Error ? error.stack : undefined;

    const event = {
      event_id: eventId,
      timestamp: sentAt,
      platform: "node",
      level: "error",
      environment: process.env.NODE_ENV ?? "production",
      message,
      exception: {
        values: [
          {
            type: errorName,
            value: message,
            stacktrace: stack ? { frames: stackToFrames(stack) } : undefined,
          },
        ],
      },
      extra,
    };

    const envelope = [
      JSON.stringify({ event_id: eventId, sent_at: sentAt, dsn }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(event),
    ].join("\n");

    await fetch(parsed.ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=osungtech-erp-lite/1.0, sentry_key=${parsed.publicKey}`,
      },
      body: envelope,
    });
  } catch {
    // 에러 리포팅 자체가 실패해도(네트워크 문제 등) 원래 요청 흐름을
    // 막지 않는다 — 조용히 무시한다. 서버 로그(onRequestError의
    // console.error)에는 이미 별도로 남는다.
  }
}

// Sentry 스택트레이스 프레임은 "가장 오래된 호출이 배열 맨 앞"이어야
// 한다 — Error.stack 텍스트는 반대 순서라 뒤집는다. 파일/줄/함수명까지
// 정확히 파싱하려 들지 않고(엔진마다 포맷이 미묘하게 다름), 줄 텍스트
// 그대로를 function명 자리에 넣어 "스택이 아예 안 보이는 것"보다는
// 낫게만 만든다.
function stackToFrames(stack: string): { function: string }[] {
  return stack
    .split("\n")
    .slice(1)
    .map((line) => ({ function: line.trim() }))
    .reverse();
}
