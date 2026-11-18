// ERP 응답속도 기준 — 반복 입력하는 사무 업무에서 "기다린다"고 느끼기 시작하는 선. 이 기준을 넘는 순간만 기록한다
// (느린 화면 기록: 서버 page-timing.ts, 사용자가 실제로 체감한 이동 시간: nav-timing-reporter.tsx).
// 기준을 바꿀 때는 여기 한 곳만 고친다.
export const PERF_BUDGET = {
  // 클릭 후 화면(내용까지)이 보이기까지 — 이보다 오래 걸린 이동을 느림으로 기록한다.
  navigationMs: 2000,
  // 화면 하나가 서버에서 만들어지는 시간.
  serverPageMs: 800,
  // 한 화면이 Supabase를 부른 횟수 — 넘으면 시간이 짧아도 "조회가 과하다"고 기록한다.
  dbCallsPerPage: 30,
} as const;

// 플랫폼 관리자에게 푸시 알림을 보내는 기준. 기록(서버 오류·느린 화면 목록)은 기준을 넘는 모든 건을 남기고, 알림은 "심할 때만" 보낸다 —
// 알림이 잦으면 무시하게 되기 때문이다. 같은 항목의 알림은 쿨다운 동안 다시 보내지 않는다. 기준은 이 한 곳에서만 바꾼다.
export const PERF_ALERT = {
  // 한 번이라도 이만큼 걸린 화면/이동은 바로 알린다.
  severeMs: 10_000,
  // 같은 화면이 이 시간(분) 안에 repeatCount 번 이상 느리면 알린다.
  repeatWindowMin: 10,
  repeatCount: 5,
  // 서버 화면 오류는 이 시간 안에 이만큼 나면 알린다(오류는 한 번도 중요하지만 일시 장애 1건에 깨우지 않는다).
  errorRepeatCount: 3,
  // 같은 항목 알림 사이 최소 간격(분).
  cooldownMin: 30,
} as const;
